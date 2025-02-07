const WebSocket = require('ws');
const readline = require('readline');

class BlockchainClient {
    constructor() {
        this.ws = null;
        this.username = null;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    connect() {
        console.log('Connecting to blockchain network...');
        this.ws = new WebSocket('ws://localhost:6001');
        
        this.ws.on('open', () => {
            console.log('✅ Connected successfully!');
            this.registerOrLogin();
        });

        this.ws.on('error', (error) => {
            console.log('❌ Connection failed! Make sure server is running.');
            process.exit(1);
        });

        this.ws.on('message', (data) => {
            const message = JSON.parse(data);
            switch(message.type) {
                case 'AUTH_SUCCESS':
                    console.log('✅ ' + (message.message || 'Login successful!'));
                    console.log('\nCurrent Blockchain:');
                    console.table(message.blockchain);
                    this.showMenu();
                    break;
                case 'AUTH_ERROR':
                    console.log('❌ Error:', message.message);
                    this.registerOrLogin();
                    break;
                case 'ERROR':
                    console.log('❌ Server Error:', message.message);
                    this.showMenu();
                    break;
                case 'NEW_BLOCK':
                    console.log('\n📦 New block received:');
                    console.log('Creator:', message.block.creator);
                    console.log('Previous Hash:', message.block.previousHash);
                    console.log('Hash:', message.block.hash);
                    console.log('Data:', message.block.data);
                    this.showMenu();
                    break;
                case 'BLOCKCHAIN':
                    console.log('\n📊 Current Blockchain:');
                    message.blockchain.forEach(block => {
                        console.log('\n📦 Block #' + block.index);
                        console.log('├─ Hash:', block.hash);
                        console.log('├─ Previous Hash:', block.previousHash);
                        console.log('├─ Data:', block.data);
                        console.log('├─ Creator:', block.data.creator || 'Genesis');
                        console.log('└─ Timestamp:', new Date(block.timestamp).toLocaleString());
                        console.log('----------------------------------------');
                    });
                    this.showMenu();
                    break;
            }
        });
    }

    registerOrLogin() {
        this.rl.question('Choose option:\n1. Register\n2. Login\nEnter choice (1 or 2): ', (choice) => {
            if (choice === '1') {
                this.register();
            } else {
                this.login();
            }
        });
    }

    register() {
        this.rl.question('Choose username: ', (username) => {
            this.rl.question('Choose password: ', (password) => {
                this.username = username;
                this.ws.send(JSON.stringify({
                    type: 'AUTH',
                    username,
                    password,
                    isRegister: true
                }));
            });
        });
    }

    login() {
        this.rl.question('Username: ', (username) => {
            this.rl.question('Password: ', (password) => {
                this.username = username;
                this.ws.send(JSON.stringify({
                    type: 'AUTH',
                    username,
                    password
                }));
            });
        });
    }

    showMenu() {
        console.log('\n🔧 Options:');
        console.log('1. Add new data to blockchain');
        console.log('2. View current blockchain');
        console.log('3. Exit');
        
        this.rl.question('\nChoose option (1-3): ', (choice) => {
            switch(choice) {
                case '1':
                    this.addNewBlock();
                    break;
                case '2':
                    this.viewBlockchain();
                    break;
                case '3':
                    console.log('👋 Goodbye!');
                    process.exit(0);
                    break;
                default:
                    console.log('Invalid option!');
                    this.showMenu();
            }
        });
    }

    addNewBlock() {
        this.rl.question('Enter your data: ', (data) => {
            this.ws.send(JSON.stringify({
                type: 'NEW_BLOCK',
                block: {
                    data: data,
                    creator: this.username,
                    timestamp: Date.now()
                }
            }));
        });
    }

    viewBlockchain() {
        this.ws.send(JSON.stringify({ 
            type: 'GET_BLOCKCHAIN' 
        }));
    }
}

console.log('🔗 Blockchain Client\n');
const client = new BlockchainClient();
client.connect();
