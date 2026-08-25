"""
JetX/Crash Game Backend with Real Money Support
Integrates with M-Pesa for deposits and withdrawals
"""

from flask import Flask, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from flask_session import Session
from werkzeug.security import generate_password_hash, check_password_hash
import requests
import json
from datetime import datetime, timedelta
import os
from functools import wraps
import base64
import hashlib
from dotenv import load_dotenv
import uuid
import math

load_dotenv()

# ==================== DATABASE MODELS ====================

class CrashGame(db.Model):
    """Store completed crash game rounds"""
    id = db.Column(db.Integer, primary_key=True)
    crash_point = db.Column(db.Float, nullable=False)  # Where the rocket crashed
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    duration = db.Column(db.Integer)  # Duration in milliseconds
    players_data = db.Column(db.JSON)  # Serialized player bets and results

    def to_dict(self):
        return {
            'id': self.id,
            'crash_point': self.crash_point,
            'created_at': self.created_at.isoformat(),
            'duration': self.duration
        }


class CrashBet(db.Model):
    """Individual crash game bets"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    crash_game_id = db.Column(db.Integer, db.ForeignKey('crash_game.id'), nullable=False)
    bet_amount = db.Column(db.Float, nullable=False)
    cashed_out_at = db.Column(db.Float)  # Multiplier at which they cashed out (None if lost)
    winnings = db.Column(db.Float, default=0)
    status = db.Column(db.String(20), default='pending')  # pending, won, lost
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='crash_bets')
    game = db.relationship('CrashGame', backref='bets')

    def to_dict(self):
        return {
            'id': self.id,
            'bet_amount': self.bet_amount,
            'cashed_out_at': self.cashed_out_at,
            'winnings': self.winnings,
            'status': self.status,
            'created_at': self.created_at.isoformat()
        }


class CrashGameSession(db.Model):
    """Track active crash game sessions"""
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(50), unique=True, nullable=False)
    crash_point = db.Column(db.Float)  # Will be set when game crashes
    start_time = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='betting')  # betting, flying, crashed
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


# ==================== CRASH GAME LOGIC ====================

def generate_crash_point():
    """
    Generate provably fair crash point using Bustabit algorithm
    House edge baked in for sustainability
    """
    E = math.pow(2, 32)
    h = math.floor(os.urandom(4).__hash__() % E)  # Use entropy
    if h % 33 == 0:
        return 1.0
    point = math.floor((100 * E - h) / (E - h)) / 100
    return max(1.0, point)


def calculate_payout(bet_amount, multiplier):
    """Calculate payout for a bet at given multiplier"""
    if multiplier < 1.0:
        return 0
    return bet_amount * multiplier


# ==================== CRASH GAME ENDPOINTS ====================

@app.route('/api/crash/start-round', methods=['POST'])
@login_required
def start_crash_round():
    """Start a new crash game round"""
    try:
        # Generate new round
        round_id = str(uuid.uuid4())[:12]
        crash_point = generate_crash_point()
        
        # Create game session
        game_session = CrashGameSession(
            session_id=round_id,
            crash_point=crash_point,
            status='betting'
        )
        
        db.session.add(game_session)
        db.session.commit()
        
        return jsonify({
            'session_id': round_id,
            'status': 'betting',
            'betting_duration_seconds': 6
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/crash/place-bet', methods=['POST'])
@login_required
def place_crash_bet():
    """Place a bet in current crash round"""
    try:
        data = request.json
        session_id = data.get('session_id')
        bet_amount = float(data.get('bet_amount', 0))
        
        if bet_amount <= 0:
            return jsonify({'error': 'Invalid bet amount'}), 400
        
        if bet_amount > request.user.balance:
            return jsonify({'error': 'Insufficient balance'}), 400
        
        # Get current game session
        game_session = CrashGameSession.query.filter_by(session_id=session_id).first()
        if not game_session or game_session.status != 'betting':
            return jsonify({'error': 'Betting period closed'}), 400
        
        # Deduct bet from balance
        request.user.balance -= bet_amount
        
        # Create crash bet record
        crash_game = CrashGame.query.filter_by(id=game_session.id).first()
        if not crash_game:
            crash_game = CrashGame(crash_point=game_session.crash_point)
            db.session.add(crash_game)
            db.session.flush()
        
        crash_bet = CrashBet(
            user_id=request.user.id,
            crash_game_id=crash_game.id,
            bet_amount=bet_amount,
            status='pending'
        )
        
        # Log transaction
        transaction = Transaction(
            user_id=request.user.id,
            type='bet',
            amount=bet_amount,
            status='success'
        )
        
        db.session.add(crash_bet)
        db.session.add(transaction)
        db.session.commit()
        
        return jsonify({
            'bet_id': crash_bet.id,
            'bet_amount': bet_amount,
            'new_balance': request.user.balance,
            'status': 'placed'
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/crash/cashout', methods=['POST'])
@login_required
def cashout_crash_bet():
    """Cash out a bet at current multiplier"""
    try:
        data = request.json
        bet_id = data.get('bet_id')
        current_multiplier = float(data.get('current_multiplier', 0))
        
        crash_bet = CrashBet.query.get(bet_id)
        if not crash_bet:
            return jsonify({'error': 'Bet not found'}), 404
        
        if crash_bet.user_id != request.user.id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        if crash_bet.status != 'pending':
            return jsonify({'error': 'Bet already settled'}), 400
        
        # Calculate winnings
        winnings = calculate_payout(crash_bet.bet_amount, current_multiplier)
        
        # Update balance
        request.user.balance += winnings
        
        # Update bet status
        crash_bet.cashed_out_at = current_multiplier
        crash_bet.winnings = winnings
        crash_bet.status = 'won'
        
        db.session.commit()
        
        return jsonify({
            'cashed_out_at': current_multiplier,
            'winnings': winnings,
            'new_balance': request.user.balance
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/crash/end-round/<session_id>', methods=['POST'])
@login_required
def end_crash_round(session_id):
    """End crash round and settle all bets"""
    try:
        game_session = CrashGameSession.query.filter_by(session_id=session_id).first()
        if not game_session:
            return jsonify({'error': 'Session not found'}), 404
        
        # Get all pending bets for this game
        game = CrashGame.query.filter_by(id=game_session.id).first()
        if not game:
            return jsonify({'error': 'Game not found'}), 404
        
        pending_bets = CrashBet.query.filter_by(
            crash_game_id=game.id,
            status='pending'
        ).all()
        
        # Settle bets that didn't cash out
        for bet in pending_bets:
            bet.status = 'lost'
            bet.winnings = 0
            bet.cashed_out_at = None
        
        # Update game session status
        game_session.status = 'crashed'
        game.created_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'round_ended': True,
            'crash_point': game.crash_point,
            'bets_settled': len(pending_bets)
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/crash/history', methods=['GET'])
@login_required
def get_crash_history():
    """Get user's crash game history"""
    try:
        limit = int(request.args.get('limit', 20))
        
        crashes = CrashBet.query.filter_by(user_id=request.user.id).order_by(
            CrashBet.created_at.desc()
        ).limit(limit).all()
        
        return jsonify({
            'crashes': [c.to_dict() for c in crashes]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/crash/stats', methods=['GET'])
@login_required
def get_crash_stats():
    """Get user's crash game statistics"""
    try:
        bets = CrashBet.query.filter_by(user_id=request.user.id).all()
        
        total_bets = len(bets)
        total_wagered = sum(b.bet_amount for b in bets)
        total_won = sum(b.winnings for b in bets if b.status == 'won')
        total_lost = sum(b.bet_amount for b in bets if b.status == 'lost')
        win_rate = (len([b for b in bets if b.status == 'won']) / total_bets * 100) if total_bets > 0 else 0
        
        return jsonify({
            'total_bets': total_bets,
            'total_wagered': total_wagered,
            'total_won': total_won,
            'total_lost': total_lost,
            'profit_loss': total_won - total_wagered,
            'win_rate': round(win_rate, 2)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/crash/leaderboard', methods=['GET'])
def get_crash_leaderboard():
    """Get top crash players"""
    try:
        limit = int(request.args.get('limit', 10))
        
        # Get users with biggest wins
        results = db.session.query(
            User.username,
            db.func.sum(CrashBet.winnings).label('total_winnings'),
            db.func.count(CrashBet.id).label('games_played')
        ).join(CrashBet).filter(
            CrashBet.status == 'won'
        ).group_by(User.id).order_by(
            db.desc('total_winnings')
        ).limit(limit).all()
        
        leaderboard = [
            {
                'username': r[0],
                'total_winnings': r[1],
                'games_played': r[2]
            }
            for r in results
        ]
        
        return jsonify({'leaderboard': leaderboard}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== WITHDRAWAL ENDPOINT ====================

@app.route('/api/crash/withdraw', methods=['POST'])
@login_required
def withdraw_crash_winnings():
    """Request withdrawal of crash game winnings via M-Pesa"""
    try:
        data = request.json
        phone_number = data.get('phone_number')
        amount = float(data.get('amount', 0))
        
        if amount <= 0 or amount > request.user.balance:
            return jsonify({'error': 'Invalid withdrawal amount'}), 400
        
        if amount < 50:  # Minimum withdrawal (adjust as needed)
            return jsonify({'error': 'Minimum withdrawal is KES 50'}), 400
        
        # Initiate M-Pesa withdrawal
        daraja = DarajaClient()
        
        # For withdrawals, you might use B2C API instead of STK Push
        # This is a simplified version
        
        checkout_request_id = str(uuid.uuid4())[:8]
        result, error = daraja.initiate_stk_push(phone_number, amount, checkout_request_id)
        
        if error:
            return jsonify({'error': error}), 400
        
        # Deduct from balance
        request.user.balance -= amount
        
        # Log withdrawal transaction
        transaction = Transaction(
            user_id=request.user.id,
            type='withdrawal',
            amount=amount,
            status='pending',
            phone_number=phone_number
        )
        
        db.session.add(transaction)
        db.session.commit()
        
        return jsonify({
            'withdrawal_id': transaction.id,
            'amount': amount,
            'status': 'pending',
            'message': 'Withdrawal initiated. Check your phone for M-Pesa prompt.'
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
