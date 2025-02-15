const express = require('express');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// State variables
let currentAdmin = null;
let isVoteActive = false;
let connectedUsers = new Map();
let currentVotes = new Map();

// Calculate voting results
function calculateResults() {
    const results = {
        approve: 0,
        oppose: 0,
        abstain: 0,
        notParticipating: 0
    };

    console.log('Current votes:', Array.from(currentVotes.entries()));
    currentVotes.forEach((vote) => {
        if (results.hasOwnProperty(vote)) {
            results[vote]++;
        }
    });

    console.log('Calculated results:', results);
    return results;
}

// Update admin with current state
function updateAdmin() {
    if (currentAdmin) {
        const results = calculateResults();
        io.to(currentAdmin).emit('voteUpdate', results);
        io.to(currentAdmin).emit('userCount', connectedUsers.size);
        
        // Send detailed statistics
        const stats = {
            totalUsers: connectedUsers.size,
            votedCount: currentVotes.size,
            notVotedCount: connectedUsers.size - currentVotes.size
        };
        io.to(currentAdmin).emit('statisticsUpdate', stats);
    }
}

// Socket.IO event handlers
io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    // Handle admin registration
    socket.on('registerAdmin', () => {
        console.log('Admin registration attempt:', socket.id);
        if (!currentAdmin) {
            currentAdmin = socket.id;
            socket.isAdmin = true;
            socket.emit('adminRegistered', true);
            updateAdmin();
            
            // Send current user list to admin
            connectedUsers.forEach(user => {
                socket.emit('user-connected', {
                    id: user.id,
                    username: user.username,
                    hasVoted: currentVotes.has(user.id)
                });
            });
            
            console.log('Admin registered successfully:', socket.id);
        } else {
            socket.emit('adminRegistered', false);
            console.log('Admin registration rejected - admin exists');
        }
    });

    // Handle user login
    socket.on('userLogin', (username) => {
        if (!socket.isAdmin) {
            console.log(`User logged in: ${username} (${socket.id})`);
            connectedUsers.set(socket.id, {
                id: socket.id,
                username: username
            });
            
            // Notify admin of new user
            if (currentAdmin) {
                io.to(currentAdmin).emit('user-connected', {
                    id: socket.id,
                    username: username,
                    hasVoted: false
                });
                updateAdmin();
            }
        }
    });

    // Handle vote submission
    socket.on('submit-vote', (voteData) => {
        console.log('Vote received:', { userId: socket.id, vote: voteData.vote });
        
        if (!isVoteActive) {
            socket.emit('vote-error', 'Voting session is not active');
            return;
        }
        
        if (!connectedUsers.has(socket.id)) {
            socket.emit('vote-error', 'User not registered');
            return;
        }
        
        if (currentVotes.has(socket.id)) {
            socket.emit('vote-error', 'You have already voted');
            return;
        }

        // Record the vote
        currentVotes.set(socket.id, voteData.vote);
        
        // Send confirmation to voter
        socket.emit('vote-confirmed', voteData.vote);
        
        // Notify admin
        if (currentAdmin) {
            const user = connectedUsers.get(socket.id);
            io.to(currentAdmin).emit('vote-submitted', {
                userId: socket.id,
                username: user.username,
                vote: voteData.vote
            });
            updateAdmin();
        }
    });

    // Start voting session
    socket.on('startSession', () => {
        if (socket.id === currentAdmin) {
            console.log('Starting new voting session');
            isVoteActive = true;
            currentVotes.clear();
            io.emit('vote-started');
            updateAdmin();
        }
    });

    // End voting session
    socket.on('endSession', () => {
        if (socket.id === currentAdmin) {
            console.log('Ending voting session');
            isVoteActive = false;
            const finalResults = calculateResults();
            io.emit('vote-ended', finalResults);
            updateAdmin();
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        if (socket.isAdmin) {
            currentAdmin = null;
            console.log('Admin disconnected');
        } else {
            if (connectedUsers.has(socket.id)) {
                const user = connectedUsers.get(socket.id);
                console.log('User disconnected:', user.username);
                connectedUsers.delete(socket.id);
                currentVotes.delete(socket.id);
                
                // Notify admin
                if (currentAdmin) {
                    io.to(currentAdmin).emit('user-disconnected', socket.id);
                    updateAdmin();
                }
            }
        }
    });
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/about.html'));
});

app.get('/admin-vote', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin.html'));
});

app.get('/votant', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/votant.html'));
});

// Handle 404
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '../public/404.html'));
});

// Start server
http.listen(PORT, () => {
    console.clear();
    console.log('\x1b[36m%s\x1b[0m', '='.repeat(50));
    console.log('\x1b[32m%s\x1b[0m', `🚀 Server running on port ${PORT}`);
    console.log('\x1b[36m%s\x1b[0m', '='.repeat(50));
    console.log('\n📍 Available routes:');
    console.log('\x1b[34m%s\x1b[0m', `➜ Home:        http://localhost:${PORT}/`);
    console.log('\x1b[34m%s\x1b[0m', `➜ About:       http://localhost:${PORT}/about`);
    console.log('\x1b[34m%s\x1b[0m', `➜ Admin:       http://localhost:${PORT}/admin-vote`);
    console.log('\x1b[34m%s\x1b[0m', `➜ Voting page: http://localhost:${PORT}/votant`);
    console.log('\x1b[36m%s\x1b[0m', '='.repeat(50));
});