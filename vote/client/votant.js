document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const loginForm = document.getElementById('loginForm');
    const username = document.getElementById('username');
    const loginBtn = document.getElementById('loginBtn');
    const statusDiv = document.getElementById('statusDiv');
    const waitingMessage = document.getElementById('waitingMessage');
    const voteOptions = document.getElementById('voteOptions');
    const resultDiv = document.getElementById('results');
    const votingSection = document.getElementById('votingSection');

    // State variables
    let socket = null;
    let hasVoted = false;

    // Vote type constants
    const VOTE_TYPES = {
        APPROVE: 'approve',
        OPPOSE: 'oppose',
        ABSTAIN: 'abstain',
        NOT_PARTICIPATING: 'notParticipating'
    };

    // Event Handlers
    loginBtn.addEventListener('click', handleLogin);
    username.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

    function handleLogin() {
        const name = username.value.trim();
        if (name.length < 3) {
            showError('Username must be at least 3 characters!');
            return;
        }

        initializeSocket();
        socket.emit('userLogin', name);

        loginForm.style.display = 'none';
        votingSection.style.display = 'block';
        waitingMessage.style.display = 'block';
        waitingMessage.textContent = 'Waiting for voting session to start...';
    }

    // Initialize socket connection
    function initializeSocket() {
        if (socket) {
            socket.disconnect();
        }

        socket = io({
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5
        });

        setupSocketListeners();
    }

    // Setup socket event listeners
    function setupSocketListeners() {
        socket.on('connect', () => {
            updateStatus('Connected', 'connected');
        });

        socket.on('disconnect', () => {
            updateStatus('Disconnected', 'disconnected');
            attemptReconnect();
        });

        socket.on('vote-started', () => {
            hasVoted = false;
            waitingMessage.style.display = 'none';
            voteOptions.style.display = 'block';
            resultDiv.innerHTML = '';
            enableVoteButtons();
        });

        socket.on('vote-confirmed', (vote) => {
            hasVoted = true;
            disableVoteButtons();
            showVoteConfirmation(vote);
        });

        socket.on('vote-ended', (results) => {
            handleVoteEnded(results);
        });

        socket.on('vote-error', (error) => {
            showError(error);
        });
    }

    // Handle vote buttons
    document.querySelectorAll('.vote-button').forEach(button => {
        button.addEventListener('click', function() {
            if (hasVoted || !socket) return;

            const voteType = this.dataset.vote;
            if (!voteType) {
                showError('Error: Unable to determine vote type');
                return;
            }

            submitVote(voteType);
        });
    });

    // Utility functions
    function submitVote(voteType) {
        if (!socket || hasVoted) return;

        socket.emit('submit-vote', { vote: voteType });
        disableVoteButtons();
    }

    function handleVoteEnded(results) {
        voteOptions.style.display = 'none';
        waitingMessage.style.display = 'block';
        waitingMessage.textContent = hasVoted ? 
            'Thank you for voting. Waiting for next session...' : 
            'Voting session has ended. Waiting for next session...';

        if (results) {
            displayResults(results);
        }
    }

    function displayResults(results) {
        const total = Object.values(results).reduce((a, b) => a + b, 0);
        const resultHTML = Object.entries(results).map(([type, count]) => {
            const percent = total > 0 ? Math.round((count / total) * 100) : 0;
            return `
                <div class="result-item">
                    <div class="result-label">${getVoteTypeLabel(type)}</div>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${percent}%"></div>
                        <span class="progress-text">${count} votes (${percent}%)</span>
                    </div>
                </div>
            `;
        }).join('');

        resultDiv.innerHTML = `
            <div class="results-container">
                <h3>Voting Results</h3>
                ${resultHTML}
                <div class="total-votes">Total votes: ${total}</div>
            </div>
        `;
    }

    // Helper functions
    function updateStatus(message, className) {
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.className = className;
        }
    }

    function enableVoteButtons() {
        document.querySelectorAll('.vote-button').forEach(btn => {
            btn.disabled = false;
            btn.classList.remove('disabled');
        });
    }

    function disableVoteButtons() {
        document.querySelectorAll('.vote-button').forEach(btn => {
            btn.disabled = true;
            btn.classList.add('disabled');
        });
    }

    function showVoteConfirmation(vote) {
        waitingMessage.style.display = 'block';
        waitingMessage.textContent = `Your vote has been recorded: ${getVoteTypeLabel(vote)}`;
        waitingMessage.className = 'success-message';
    }

    function getVoteTypeLabel(type) {
        const labels = {
            [VOTE_TYPES.APPROVE]: 'Approve',
            [VOTE_TYPES.OPPOSE]: 'Oppose',
            [VOTE_TYPES.ABSTAIN]: 'Abstain',
            [VOTE_TYPES.NOT_PARTICIPATING]: 'Not Participating'
        };
        return labels[type] || type;
    }

    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 3000);
    }

    function attemptReconnect() {
        if (socket) {
            setTimeout(() => {
                socket.connect();
            }, 1000);
        }
    }
});