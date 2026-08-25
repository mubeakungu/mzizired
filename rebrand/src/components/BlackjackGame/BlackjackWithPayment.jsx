import React, { useState, useEffect } from 'react';
import { DollarSign, Wallet, History, Plus, Minus, VolumeX, Volume2 } from 'lucide-react';

const BlackjackWithPayment = () => {
  // Game state
  const [gameState, setGameState] = useState('betting'); // betting, playing, result, depositing
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [playerScore, setPlayerScore] = useState(0);
  const [dealerScore, setDealerScore] = useState(0);
  const [dealerScoreHidden, setDealerScoreHidden] = useState(0);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState('');
  const [muted, setMuted] = useState(false);

  // Wallet state
  const [wallet, setWallet] = useState(0);
  const [currentBet, setCurrentBet] = useState(0);
  const [betInput, setBetInput] = useState('100');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  // M-Pesa deposit state
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);

  useEffect(() => {
    fetchWallet();
    fetchHistory();
  }, []);

  const fetchWallet = async () => {
    try {
      const response = await fetch('/api/wallet/balance');
      const data = await response.json();
      setWallet(data.balance || 0);
    } catch (error) {
      console.error('Error fetching wallet:', error);
      setMessage('Error loading wallet');
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/blackjack/history?limit=5');
      const data = await response.json();
      setHistory(data.games || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  // Card utilities
  const createDeck = () => {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];
    for (let suit of suits) {
      for (let rank of ranks) {
        deck.push({ rank, suit });
      }
    }
    return deck.sort(() => Math.random() - 0.5);
  };

  const getCardValue = (card) => {
    if (card.rank === 'K' || card.rank === 'Q' || card.rank === 'J') return 10;
    if (card.rank === 'A') return 11;
    return parseInt(card.rank);
  };

  const calculateScore = (hand, hideAce = false) => {
    let score = 0;
    let aces = 0;
    for (let i = 0; i < hand.length; i++) {
      if (hideAce && i === 0) continue; // Hide dealer's first card
      const value = getCardValue(hand[i]);
      score += value;
      if (hand[i].rank === 'A') aces++;
    }
    while (score > 21 && aces > 0) {
      score -= 10;
      aces--;
    }
    return score;
  };

  const placeBet = async () => {
    const bet = parseInt(betInput);
    if (isNaN(bet) || bet <= 0) {
      setMessage('Enter a valid bet amount');
      return;
    }
    if (bet > wallet) {
      setMessage('Insufficient balance');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/blackjack/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bet_amount: bet })
      });
      const data = await response.json();
      if (response.ok) {
        setCurrentBet(bet);
        setWallet(data.new_balance);
        startGame(bet);
      } else {
        setMessage(data.error || 'Error placing bet');
      }
    } catch (error) {
      setMessage('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const startGame = (bet) => {
    const deck = createDeck();
    const playerCards = [deck.pop(), deck.pop()];
    const dealerCards = [deck.pop(), deck.pop()];

    setPlayerHand(playerCards);
    setDealerHand(dealerCards);
    setPlayerScore(calculateScore(playerCards));
    setDealerScoreHidden(calculateScore(dealerCards, true));
    setGameState('playing');
    setMessage('');
  };

  const hit = async () => {
    const deck = createDeck();
    const newHand = [...playerHand, deck.pop()];
    setPlayerHand(newHand);
    const newScore = calculateScore(newHand);
    setPlayerScore(newScore);

    if (newScore > 21) {
      endGame('bust', newScore, 0);
    }
  };

  const stand = async () => {
    let dealerCards = [...dealerHand];
    let dealerTotal = calculateScore(dealerCards);
    const deck = createDeck();

    while (dealerTotal < 17) {
      dealerCards.push(deck.pop());
      dealerTotal = calculateScore(dealerCards);
    }

    setDealerHand(dealerCards);
    const playerTotal = playerScore;

    let outcome = '';
    if (dealerTotal > 21) {
      outcome = 'win';
    } else if (playerTotal > dealerTotal) {
      outcome = 'win';
    } else if (playerTotal < dealerTotal) {
      outcome = 'loss';
    } else {
      outcome = 'push';
    }

    endGame(outcome, playerTotal, dealerTotal);
  };

  const endGame = async (outcome, playerTotal, dealerTotal) => {
    setGameState('result');
    setResult(outcome);

    try {
      const response = await fetch('/api/blackjack/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome,
          bet_amount: currentBet,
          player_score: playerTotal,
          dealer_score: dealerTotal
        })
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(data.result_message);
        setWallet(data.new_balance);
        fetchHistory();
      }
    } catch (error) {
      console.error('Error ending game:', error);
    }
  };

  const newGame = () => {
    setGameState('betting');
    setPlayerHand([]);
    setDealerHand([]);
    setPlayerScore(0);
    setDealerScore(0);
    setCurrentBet(0);
    setBetInput('100');
    setMessage('');
    setResult('');
  };

  const initiateDeposit = async () => {
    if (!depositAmount || !phone) {
      setMessage('Enter amount and phone');
      return;
    }

    setDepositLoading(true);
    try {
      const response = await fetch('/api/payments/initiate-stk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: phone,
          amount: parseFloat(depositAmount)
        })
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(`M-Pesa prompt sent to ${phone}`);
        setShowDeposit(false);
        setDepositAmount('');
        setPhone('');
        setTimeout(fetchWallet, 3000);
      } else {
        setMessage(data.error);
      }
    } catch (error) {
      setMessage('Error: ' + error.message);
    } finally {
      setDepositLoading(false);
    }
  };

  const CardDisplay = ({ card, hidden = false }) => (
    <div style={{
      width: 80,
      height: 120,
      background: hidden ? '#2A3D5C' : '#EDEFF7',
      border: hidden ? '2px solid #5A6280' : '2px solid #000',
      borderRadius: 8,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 20,
      fontWeight: 'bold',
      color: hidden ? '#5A6280' : '#000',
      margin: '0 4px',
      position: 'relative'
    }}>
      {!hidden && (
        <>
          <span style={{ position: 'absolute', top: 4, left: 4 }}>
            {card.rank}{card.suit}
          </span>
          <span>{card.rank}</span>
          <span style={{ position: 'absolute', bottom: 4, right: 4, transform: 'rotate(180deg)' }}>
            {card.rank}{card.suit}
          </span>
        </>
      )}
    </div>
  );

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      color: '#EDEFF7',
      minHeight: '100vh',
      padding: '20px',
      fontFamily: 'Sora, sans-serif'
    }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 30,
          borderBottom: '2px solid #7C5CFF',
          paddingBottom: 20
        }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0 }}>Blackjack</h1>
            <p style={{ color: '#8891AA', margin: '4px 0 0 0' }}>Real Money • M-Pesa Enabled</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              onClick={() => setMuted(!muted)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                border: '2px solid #7C5CFF',
                background: 'transparent',
                color: '#7C5CFF',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <button
              onClick={() => setShowDeposit(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                background: '#7C5CFF',
                border: 'none',
                borderRadius: 10,
                color: '#EDEFF7',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              <DollarSign size={18} /> Deposit
            </button>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#131A2C',
              border: '2px solid #7C5CFF',
              borderRadius: 10,
              padding: '10px 16px'
            }}>
              <Wallet size={18} color='#FFC94A' />
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 16 }}>
                KES {wallet.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Game Area */}
        <div style={{
          background: 'linear-gradient(180deg, #0B0F1C 0%, #131A2C 100%)',
          border: '2px solid #232C48',
          borderRadius: 16,
          padding: 40,
          marginBottom: 30,
          minHeight: 500,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          {/* Dealer Hand */}
          <div>
            <h3 style={{ color: '#8891AA', fontSize: 12, fontWeight: 600, letterSpacing: 2, marginBottom: 12 }}>
              DEALER
            </h3>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              {dealerHand.map((card, i) => (
                <CardDisplay key={i} card={card} hidden={gameState === 'playing' && i === 0} />
              ))}
            </div>
            {gameState !== 'betting' && (
              <p style={{ color: '#FFC94A', fontSize: 14, fontWeight: 600 }}>
                Score: {gameState === 'playing' ? dealerScoreHidden : calculateScore(dealerHand)}
              </p>
            )}
          </div>

          {/* Messages */}
          <div style={{ textAlign: 'center' }}>
            {message && (
              <p style={{
                fontSize: 18,
                fontWeight: 700,
                color: result === 'win' ? '#4ADE9A' : result === 'loss' ? '#FF5C82' : '#FFC94A',
                margin: '20px 0'
              }}>
                {message}
              </p>
            )}
          </div>

          {/* Player Hand */}
          <div>
            <h3 style={{ color: '#8891AA', fontSize: 12, fontWeight: 600, letterSpacing: 2, marginBottom: 12 }}>
              YOUR HAND
            </h3>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              {playerHand.map((card, i) => (
                <CardDisplay key={i} card={card} />
              ))}
            </div>
            {gameState !== 'betting' && (
              <p style={{ color: '#FFC94A', fontSize: 14, fontWeight: 600 }}>
                Score: {playerScore}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {gameState === 'betting' && (
          <div style={{
            background: '#131A2C',
            border: '2px solid #232C48',
            borderRadius: 14,
            padding: 24,
            marginBottom: 20
          }}>
            <h3 style={{ color: '#8891AA', fontSize: 12, fontWeight: 600, letterSpacing: 2, marginBottom: 16 }}>
              PLACE BET
            </h3>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
              <button
                onClick={() => setBetInput(Math.max(10, parseInt(betInput) - 50))}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  border: '2px solid #232C48',
                  background: 'transparent',
                  color: '#7C5CFF',
                  cursor: 'pointer',
                  fontSize: 20
                }}
              >
                <Minus />
              </button>
              <input
                type='number'
                value={betInput}
                onChange={(e) => setBetInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: '12px',
                  fontSize: 18,
                  fontWeight: 600,
                  background: '#0E1424',
                  border: '2px solid #232C48',
                  borderRadius: 8,
                  color: '#EDEFF7',
                  textAlign: 'center',
                  fontFamily: 'JetBrains Mono, monospace'
                }}
              />
              <button
                onClick={() => setBetInput(parseInt(betInput) + 50)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  border: '2px solid #232C48',
                  background: 'transparent',
                  color: '#7C5CFF',
                  cursor: 'pointer',
                  fontSize: 20
                }}
              >
                <Plus />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
              {[100, 500, 1000, 5000].map(amt => (
                <button
                  key={amt}
                  onClick={() => setBetInput(amt.toString())}
                  style={{
                    padding: '10px',
                    background: '#0E1424',
                    border: '2px solid #232C48',
                    borderRadius: 8,
                    color: '#B7BEDA',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  KES {amt}
                </button>
              ))}
            </div>
            <button
              onClick={placeBet}
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: '#7C5CFF',
                border: 'none',
                borderRadius: 10,
                color: '#EDEFF7',
                fontWeight: 700,
                fontSize: 16,
                cursor: loading ? 'wait' : 'pointer'
              }}
            >
              {loading ? 'Placing Bet...' : 'Deal Cards'}
            </button>
          </div>
        )}

        {gameState === 'playing' && (
          <div style={{
            display: 'flex',
            gap: 12,
            marginBottom: 20,
            justifyContent: 'center'
          }}>
            <button
              onClick={hit}
              style={{
                padding: '12px 24px',
                background: '#7C5CFF',
                border: 'none',
                borderRadius: 10,
                color: '#EDEFF7',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              HIT
            </button>
            <button
              onClick={stand}
              style={{
                padding: '12px 24px',
                background: '#232C48',
                border: '2px solid #7C5CFF',
                borderRadius: 10,
                color: '#7C5CFF',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              STAND
            </button>
          </div>
        )}

        {gameState === 'result' && (
          <button
            onClick={newGame}
            style={{
              width: '100%',
              padding: '14px',
              background: '#7C5CFF',
              border: 'none',
              borderRadius: 10,
              color: '#EDEFF7',
              fontWeight: 700,
              fontSize: 16,
              cursor: 'pointer',
              marginBottom: 20
            }}
          >
            Play Again
          </button>
        )}

        {/* History */}
        {history.length > 0 && (
          <div style={{
            background: '#131A2C',
            border: '2px solid #232C48',
            borderRadius: 14,
            padding: 24
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <History size={18} color='#7C5CFF' />
              <h3 style={{ margin: 0, color: '#8891AA', fontSize: 12, fontWeight: 600, letterSpacing: 2 }}>
                RECENT GAMES
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map((game, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px',
                  background: '#0E1424',
                  borderRadius: 8,
                  fontSize: 12
                }}>
                  <span style={{ color: '#B7BEDA' }}>
                    {game.outcome.toUpperCase()} • {game.player_score} vs {game.dealer_score}
                  </span>
                  <span style={{
                    fontWeight: 600,
                    color: game.outcome === 'win' ? '#4ADE9A' : game.outcome === 'push' ? '#FFC94A' : '#FF5C82'
                  }}>
                    {game.outcome === 'win' ? '+' : ''} KES {game.winnings}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Deposit Modal */}
      {showDeposit && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50
        }}>
          <div style={{
            background: '#131A2C',
            border: '2px solid #7C5CFF',
            borderRadius: 16,
            padding: 32,
            maxWidth: 420,
            width: '90%'
          }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Deposit via M-Pesa</h2>
            <input
              type='tel'
              placeholder='Phone: 254XXXXXXXXX'
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: 12,
                background: '#0E1424',
                border: '2px solid #232C48',
                borderRadius: 8,
                color: '#EDEFF7',
                fontSize: 14
              }}
            />
            <input
              type='number'
              placeholder='Amount (KES)'
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: 20,
                background: '#0E1424',
                border: '2px solid #232C48',
                borderRadius: 8,
                color: '#EDEFF7',
                fontSize: 14
              }}
            />
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowDeposit(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'transparent',
                  border: '2px solid #232C48',
                  borderRadius: 8,
                  color: '#B7BEDA',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Cancel
              </button>
              <button
                onClick={initiateDeposit}
                disabled={depositLoading}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#7C5CFF',
                  border: 'none',
                  borderRadius: 8,
                  color: '#EDEFF7',
                  fontWeight: 700,
                  cursor: depositLoading ? 'wait' : 'pointer'
                }}
              >
                {depositLoading ? 'Processing...' : 'Send Prompt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlackjackWithPayment;
