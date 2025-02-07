const crypto = require('crypto');
const WebSocket = require('ws');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();

// Define Block class first
class Block {
    constructor(index, previousHash, timestamp, data, hash) {
        this.index = index;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
        this.hash = hash || this.calculateHash(); // Add fallback to calculate hash
    }

    calculateHash() {
        return crypto.createHash('sha256')
            .update(this.index + this.previousHash + this.timestamp + JSON.stringify(this.data))
            .digest('hex');
    }
}

// Define utility functions
function calculateHash(index, previousHash, timestamp, data) {
    return crypto.createHash('sha256').update(index + previousHash + timestamp + JSON.stringify(data)).digest('hex');
}

function createGenesisBlock() {
    return new Block(0, "0", Date.now(), "Genesis Block", calculateHash(0, "0", Date.now(), "Genesis Block"));
}

// Initialize storage
const users = new Map(); // Store user credentials
const peers = new Map(); // Store user connections
let blockchain = [createGenesisBlock()];

function getLatestBlock() {
    return blockchain[blockchain.length - 1];
}

// User Authentication
function createUser(username, password) {
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    users.set(username, hashedPassword);
    return true;
}

function authenticateUser(username, password) {
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    return users.get(username) === hashedPassword;
}

// Express Server Setup
app.use(bodyParser.json());

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (users.has(username)) {
        res.status(400).json({ error: 'Username already exists' });
        return;
    }
    createUser(username, password);
    res.json({ success: true });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (authenticateUser(username, password)) {
        const token = crypto.randomBytes(16).toString('hex');
        res.json({ token });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// WebSocket Server
const wss = new WebSocket.Server({ port: 6001 });

wss.on('connection', (ws) => {
    let username = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received message:', data.type); // Debug log
            
            switch(data.type) {
                case 'AUTH':
                    if (data.isRegister) {
                        // Handle registration
                        if (users.has(data.username)) {
                            ws.send(JSON.stringify({
                                type: 'AUTH_ERROR',
                                message: 'Username already exists'
                            }));
                        } else {
                            createUser(data.username, data.password);
                            username = data.username;
                            peers.set(username, ws);
                            console.log(`User registered: ${username}`); // Debug log
                            ws.send(JSON.stringify({
                                type: 'AUTH_SUCCESS',
                                blockchain: blockchain,
                                message: 'Registration successful'
                            }));
                        }
                    } else {
                        // Handle login
                        if (authenticateUser(data.username, data.password)) {
                            username = data.username;
                            peers.set(username, ws);
                            console.log(`User logged in: ${username}`); // Debug log
                            ws.send(JSON.stringify({
                                type: 'AUTH_SUCCESS',
                                blockchain: blockchain
                            }));
                        } else {
                            ws.send(JSON.stringify({
                                type: 'AUTH_ERROR',
                                message: 'Invalid credentials'
                            }));
                        }
                    }
                    break;

                case 'NEW_BLOCK':
                    if (username) {
                        const prevBlock = getLatestBlock();
                        const newBlock = new Block(
                            blockchain.length,
                            prevBlock.hash,
                            Date.now(),
                            {
                                data: data.block.data,
                                creator: username
                            }
                        );
                        blockchain.push(newBlock);
                        // Broadcast to all peers including sender
                        peers.forEach((peer) => {
                            peer.send(JSON.stringify({
                                type: 'NEW_BLOCK',
                                block: newBlock
                            }));
                        });
                    }
                    break;

                case 'GET_BLOCKCHAIN':
                    if (username) {
                        ws.send(JSON.stringify({
                            type: 'BLOCKCHAIN',
                            blockchain: blockchain
                        }));
                    }
                    break;
            }
        } catch (error) {
            console.error('Error processing message:', error);
            ws.send(JSON.stringify({
                type: 'ERROR',
                message: 'Internal server error'
            }));
        }
    });

    ws.on('close', () => {
        if (username) {
            peers.delete(username);
        }
    });
});

function broadcastBlock(block, sender) {
    peers.forEach((ws, username) => {
        if (username !== sender) {
            ws.send(JSON.stringify({
                type: 'NEW_BLOCK',
                block: block
            }));
        }
    });
}

function addBlock(fileHash, username) {
    let previousBlock = getLatestBlock();
    let newBlock = new Block(
        previousBlock.index + 1,
        previousBlock.hash,
        Date.now(),
        { fileHash, creator: username },
        null
    );
    newBlock.hash = calculateHash(
        newBlock.index,
        newBlock.previousHash,
        newBlock.timestamp,
        newBlock.data
    );
    blockchain.push(newBlock);
    return newBlock;
}

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
