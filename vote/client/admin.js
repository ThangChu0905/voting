document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const voteStatus = document.getElementById('voteStatus');
    const resultContent = document.getElementById('resultContent');
    const startVoteBtn = document.getElementById('startSession');
    const endVoteBtn = document.getElementById('endSession');
    const userList = document.getElementById('userList');
    const onlineCount = document.getElementById('onlineCount');
    const totalVotesDisplay = document.getElementById('totalVotes');

    // State variables
    let isVoteActive = false;
    let connectedUsers = new Map();
    let currentVotes = new Map();

    // Vote type constants
    const VOTE_TYPES = {
        APPROVE: 'approve',
        OPPOSE: 'oppose',
        ABSTAIN: 'abstain',
        NOT_PARTICIPATING: 'notParticipating'
    };

    // Initialize socket connection
    const socket = io();
    
    // Register as admin
    socket.emit('registerAdmin');
    console.log('Sent admin registration request');

    // Socket event listeners
    socket.on('adminRegistered', (success) => {
        if (success) {
            voteStatus.innerHTML = `<p class="success">✅ Registered as admin</p>`;
            startVoteBtn.disabled = false;
        } else {
            voteStatus.innerHTML = `<p class="error">❌ Admin already exists</p>`;
            startVoteBtn.disabled = true;
            endVoteBtn.disabled = true;
        }
    });

    socket.on('connect', () => {
        updateStatus('Connected', 'success');
    });

    socket.on('disconnect', () => {
        updateStatus('Disconnected', 'error');
    });

    socket.on('voteUpdate', (results) => {
        updateResults(results);
    });

    socket.on('user-connected', (userData) => {
        connectedUsers.set(userData.id, userData);
        updateUserList();
    });

    socket.on('user-disconnected', (userId) => {
        connectedUsers.delete(userId);
        currentVotes.delete(userId);
        updateUserList();
    });

    socket.on('vote-submitted', (voteData) => {
        if (isVoteActive) {
            currentVotes.set(voteData.userId, voteData.vote);
            updateUserList();
            addToVoteFeed(voteData);
        }
    });

    socket.on('statisticsUpdate', (stats) => {
        document.getElementById('totalUsers').textContent = stats.totalUsers;
        document.getElementById('votedCount').textContent = stats.votedCount;
        document.getElementById('notVotedCount').textContent = stats.notVotedCount;
    });

    // Button event handlers
    startVoteBtn.addEventListener('click', () => {
        if (!isVoteActive) {
            socket.emit('startSession');
            isVoteActive = true;
            startVoteBtn.disabled = true;
            endVoteBtn.disabled = false;
            voteStatus.innerHTML = '<p class="active">🔄 Voting session in progress</p>';
            resultContent.innerHTML = '';
            currentVotes.clear();
            updateUserList();
        }
    });

    endVoteBtn.addEventListener('click', () => {
        if (isVoteActive) {
            socket.emit('endSession');
            isVoteActive = false;
            startVoteBtn.disabled = false;
            endVoteBtn.disabled = true;
            voteStatus.innerHTML = '<p>✅ Voting session ended</p>';
        }
    });

    // Helper functions
    function updateStatus(message, className) {
        voteStatus.innerHTML = `<p class="${className}">${message}</p>`;
    }

    function updateUserList() {
        userList.innerHTML = '';
        connectedUsers.forEach(user => {
            const userDiv = document.createElement('div');
            userDiv.className = 'user-item';
            const status = currentVotes.has(user.id) 
                ? '✅ Voted' 
                : isVoteActive ? '⏳ Not voted yet' : '🔄 Waiting';
            userDiv.innerHTML = `
                <span class="user-name">${user.username}</span>
                <span class="user-status">${status}</span>
            `;
            userList.appendChild(userDiv);
        });
    }

    function updateResults(results) {
        const total = Object.values(results).reduce((a, b) => a + b, 0);
        totalVotesDisplay.textContent = total;

        const resultHTML = Object.entries(results).map(([type, count]) => {
            const percent = total > 0 ? Math.round((count / total) * 100) : 0;
            return `
                <div class="result-item">
                    <div class="result-label">${getVoteTypeLabel(type)}</div>
                    <div class="progress-bar">
                        <div class="progress" style="width: ${percent}%"></div>
                    </div>
                    <div class="result-count">${count} votes (${percent}%)</div>
                </div>
            `;
        }).join('');

        resultContent.innerHTML = `
            <div class="results">
                <h3>📊 Vote Results</h3>
                ${resultHTML}
            </div>
        `;
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

    function addToVoteFeed(voteData) {
        const feed = document.getElementById('voteFeed');
        const item = document.createElement('div');
        item.className = 'feed-item new-vote';
        item.innerHTML = `
            <span>New vote from ${voteData.username}: ${getVoteTypeLabel(voteData.vote)}</span>
            <span>${new Date().toLocaleTimeString()}</span>
        `;
        feed.insertBefore(item, feed.firstChild);
    }
});