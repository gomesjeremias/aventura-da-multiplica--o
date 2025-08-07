// Variáveis globais do jogo
let canvas, ctx;
let gameState = 'start'; // 'start', 'playing', 'gameOver', 'victory'
let score = 0;
let level = 1;
let lives = 3;
let currentQuestion = {};
let gameObjects = [];
let player = {};
let keys = {};
let animationId;

// Configurações do jogo
const GAME_CONFIG = {
    canvas: {
        width: 800,
        height: 400
    },
    player: {
        width: 32,
        height: 32,
        speed: 3,
        jumpPower: 15,
        gravity: 0.5
    },
    item: {
        width: 24,
        height: 24
    }
};

// Classe do jogador
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = GAME_CONFIG.player.width;
        this.height = GAME_CONFIG.player.height;
        this.velocityX = 0;
        this.velocityY = 0;
        this.onGround = false;
        this.direction = 1; // 1 = direita, -1 = esquerda
        this.animationFrame = 0;
        this.animationTimer = 0;
    }

    update() {
        // Movimento horizontal
        this.velocityX = 0;
        if (keys['ArrowLeft'] || keys['a']) {
            this.velocityX = -GAME_CONFIG.player.speed;
            this.direction = -1;
        }
        if (keys['ArrowRight'] || keys['d']) {
            this.velocityX = GAME_CONFIG.player.speed;
            this.direction = 1;
        }

        // Pulo
        if ((keys['ArrowUp'] || keys['w'] || keys[' ']) && this.onGround) {
            this.velocityY = -GAME_CONFIG.player.jumpPower;
            this.onGround = false;
            playSound('jump');
        }

        // Aplicar gravidade
        this.velocityY += GAME_CONFIG.player.gravity;

        // Atualizar posição
        this.x += this.velocityX;
        this.y += this.velocityY;

        // Verificar limites da tela
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;

        // Verificar chão
        const groundY = canvas.height - 60;
        if (this.y + this.height >= groundY) {
            this.y = groundY - this.height;
            this.velocityY = 0;
            this.onGround = true;
        }

        // Animação
        if (this.velocityX !== 0) {
            this.animationTimer++;
            if (this.animationTimer > 8) {
                this.animationFrame = (this.animationFrame + 1) % 4;
                this.animationTimer = 0;
            }
        } else {
            this.animationFrame = 0;
        }
    }

    draw() {
        ctx.save();
        
        // Desenhar sombra
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(this.x + 2, this.y + this.height + 2, this.width - 4, 4);
        
        // Desenhar personagem (Mario simplificado)
        ctx.fillStyle = '#FF0000'; // Chapéu vermelho
        ctx.fillRect(this.x + 8, this.y, 16, 8);
        
        ctx.fillStyle = '#FFDBAC'; // Rosto
        ctx.fillRect(this.x + 6, this.y + 8, 20, 12);
        
        ctx.fillStyle = '#0000FF'; // Camisa azul
        ctx.fillRect(this.x + 4, this.y + 20, 24, 8);
        
        ctx.fillStyle = '#8B4513'; // Calça marrom
        ctx.fillRect(this.x + 6, this.y + 28, 20, 4);
        
        // Olhos
        ctx.fillStyle = '#000000';
        ctx.fillRect(this.x + 10, this.y + 10, 2, 2);
        ctx.fillRect(this.x + 20, this.y + 10, 2, 2);
        
        // Bigode
        ctx.fillRect(this.x + 12, this.y + 14, 8, 2);
        
        ctx.restore();
    }
}

// Classe dos itens coletáveis
class Item {
    constructor(x, y, value, isCorrect = false, type = 'number') {
        this.x = x;
        this.y = y;
        this.width = GAME_CONFIG.item.width;
        this.height = GAME_CONFIG.item.height;
        this.value = value;
        this.isCorrect = isCorrect;
        this.type = type; // 'number', 'coin'
        this.collected = false;
        this.animationOffset = Math.random() * Math.PI * 2;
        this.originalY = y;
    }

    update() {
        // Animação flutuante
        this.y = this.originalY + Math.sin(Date.now() * 0.003 + this.animationOffset) * 3;
    }

    draw() {
        if (this.collected) return;

        ctx.save();
        
        if (this.type === 'coin') {
            // Desenhar moeda
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width/2, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#FFA500';
            ctx.beginPath();
            ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width/3, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Desenhar número
            const bgColor = this.isCorrect ? '#F44336' : '#F44336';
            const textColor = '#FFFFFF';
            
            // Fundo
            ctx.fillStyle = bgColor;
            ctx.fillRect(this.x, this.y, this.width, this.height);
            
            // Borda
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x, this.y, this.width, this.height);
            
            // Texto
            ctx.fillStyle = textColor;
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.value, this.x + this.width/2, this.y + this.height/2);
        }
        
        ctx.restore();
    }

    checkCollision(player) {
        return !this.collected &&
               player.x < this.x + this.width &&
               player.x + player.width > this.x &&
               player.y < this.y + this.height &&
               player.y + player.height > this.y;
    }
}

// Função para gerar uma nova pergunta de multiplicação
function generateQuestion() {
    const maxNumber = Math.min(5 + level, 10);
    const num1 = Math.floor(Math.random() * maxNumber) + 1;
    const num2 = Math.floor(Math.random() * maxNumber) + 1;
    const correctAnswer = num1 * num2;
    
    currentQuestion = {
        num1: num1,
        num2: num2,
        answer: correctAnswer,
        text: `${num1} × ${num2} = ?`
    };
    
    document.getElementById('multiplication').textContent = currentQuestion.text;
    
    // Gerar opções de resposta
    generateAnswerOptions();
}

// Função para gerar opções de resposta
function generateAnswerOptions() {
    gameObjects = []; // Limpar objetos anteriores
    
    const correctAnswer = currentQuestion.answer;
    const answers = [correctAnswer];
    
    // Gerar respostas incorretas
    while (answers.length < 4) {
        let wrongAnswer;
        do {
            const variation = Math.floor(Math.random() * 10) - 5;
            wrongAnswer = correctAnswer + variation;
        } while (wrongAnswer <= 0 || answers.includes(wrongAnswer));
        
        answers.push(wrongAnswer);
    }
    
    // Embaralhar respostas
    for (let i = answers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [answers[i], answers[j]] = [answers[j], answers[i]];
    }
    
    // Criar itens de resposta
    const spacing = canvas.width / (answers.length + 1);
    answers.forEach((answer, index) => {
        const x = spacing * (index + 1) - GAME_CONFIG.item.width / 2;
        const y = canvas.height - 150;
        const isCorrect = answer === correctAnswer;
        
        gameObjects.push(new Item(x, y, answer, isCorrect, 'number'));
    });
    
    // Adicionar algumas moedas
    for (let i = 0; i < 3; i++) {
        const x = Math.random() * (canvas.width - GAME_CONFIG.item.width);
        const y = Math.random() * (canvas.height - 200) + 50;
        gameObjects.push(new Item(x, y, 10, false, 'coin'));
    }
}

// Função para desenhar o fundo
function drawBackground() {
    // Céu
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#98FB98');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Nuvens
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let i = 0; i < 3; i++) {
        const x = (i * 300 + Date.now() * 0.02) % (canvas.width + 100) - 50;
        const y = 30 + i * 20;
        drawCloud(x, y);
    }
    
    // Árvores de fundo
    ctx.fillStyle = '#228B22';
    for (let i = 0; i < 5; i++) {
        const x = i * 160 + 50;
        const y = canvas.height - 120;
        drawTree(x, y);
    }
    
    // Chão
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(0, canvas.height - 60, canvas.width, 60);
    
    // Grama
    ctx.fillStyle = '#32CD32';
    ctx.fillRect(0, canvas.height - 65, canvas.width, 5);
}

// Função para desenhar nuvem
function drawCloud(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.arc(x + 15, y, 20, 0, Math.PI * 2);
    ctx.arc(x + 30, y, 15, 0, Math.PI * 2);
    ctx.arc(x + 15, y - 10, 15, 0, Math.PI * 2);
    ctx.fill();
}

// Função para desenhar árvore
function drawTree(x, y) {
    // Tronco
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x, y, 20, 40);
    
    // Copa
    ctx.fillStyle = '#228B22';
    ctx.beginPath();
    ctx.arc(x + 10, y - 10, 25, 0, Math.PI * 2);
    ctx.fill();
}

// Função principal de atualização do jogo
function update() {
    if (gameState !== 'playing') return;
    
    player.update();
    
    // Atualizar itens
    gameObjects.forEach(item => {
        item.update();
        
        // Verificar colisão
        if (item.checkCollision(player)) {
            item.collected = true;
            
            if (item.type === 'coin') {
                score += item.value;
                playSound('collect');
                createParticles(item.x + item.width/2, item.y + item.height/2);
            } else {
                if (item.isCorrect) {
                    score += 50;
                    playSound('collect');
                    createParticles(item.x + item.width/2, item.y + item.height/2);
                    
                    // Verificar se todas as respostas corretas foram coletadas
                    const correctItems = gameObjects.filter(obj => obj.type === 'number' && obj.isCorrect);
                    const collectedCorrect = correctItems.filter(obj => obj.collected);
                    
                    if (collectedCorrect.length === correctItems.length) {
                        setTimeout(() => {
                            nextLevel();
                        }, 500);
                    }
                } else {
                    lives--;
                    playSound('wrong');
                    flashScreen('wrong');
                    
                    if (lives <= 0) {
                        gameOver();
                    }
                }
            }
            
            updateUI();
        }
    });
}

// Função principal de renderização
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawBackground();
    
    // Desenhar itens
    gameObjects.forEach(item => item.draw());
    
    // Desenhar jogador
    player.draw();
}

// Loop principal do jogo
function gameLoop() {
    update();
    render();
    animationId = requestAnimationFrame(gameLoop);
}

// Função para criar partículas
function createParticles(x, y) {
    for (let i = 0; i < 5; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        document.body.appendChild(particle);
        
        setTimeout(() => {
            particle.remove();
        }, 1000);
    }
}

// Função para flash da tela
function flashScreen(type) {
    const gameScreen = document.getElementById('game-screen');
    gameScreen.classList.add(type === 'correct' ? 'correct-answer' : 'wrong-answer');
    
    setTimeout(() => {
        gameScreen.classList.remove('correct-answer', 'wrong-answer');
    }, 500);
}

// Função para tocar som
function playSound(soundName) {
    const audio = document.getElementById(soundName + '-sound');
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {}); // Ignorar erros de autoplay
    }
}

// Função para atualizar a interface
function updateUI() {
    document.getElementById('score-value').textContent = score;
    document.getElementById('level-value').textContent = level;
    document.getElementById('lives-value').textContent = lives;
}

// Função para próximo nível
function nextLevel() {
    level++;
    gameState = 'victory';
    document.getElementById('victory-score').textContent = score;
    showScreen('victory-screen');
}

// Função para game over
function gameOver() {
    gameState = 'gameOver';
    document.getElementById('final-score').textContent = score;
    showScreen('game-over-screen');
}

// Função para mostrar tela
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
}

// Função para iniciar o jogo
function startGame() {
    gameState = 'playing';
    score = 0;
    level = 1;
    lives = 3;
    
    // Inicializar jogador
    player = new Player(50, canvas.height - 120);
    
    // Gerar primeira pergunta
    generateQuestion();
    
    // Atualizar UI
    updateUI();
    
    // Mostrar tela do jogo
    showScreen('game-screen');
    
    // Iniciar loop do jogo
    gameLoop();
}

// Função para reiniciar o jogo
function restartGame() {
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    startGame();
}

// Função para continuar para o próximo nível
function continueGame() {
    generateQuestion();
    gameState = 'playing';
    showScreen('game-screen');
}

// Função para voltar ao menu
function goToMenu() {
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    gameState = 'start';
    showScreen('start-screen');
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    
    // Ajustar canvas para dispositivos móveis
    function resizeCanvas() {
        const container = document.getElementById('game-container');
        const maxWidth = Math.min(800, window.innerWidth - 40);
        const maxHeight = Math.min(400, window.innerHeight - 200);
        
        canvas.width = maxWidth;
        canvas.height = maxHeight;
        
        GAME_CONFIG.canvas.width = maxWidth;
        GAME_CONFIG.canvas.height = maxHeight;
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Botões
    document.getElementById('start-button').addEventListener('click', startGame);
    document.getElementById('restart-button').addEventListener('click', restartGame);
    document.getElementById('menu-button').addEventListener('click', goToMenu);
    document.getElementById('next-level-button').addEventListener('click', continueGame);
    document.getElementById('menu-button-victory').addEventListener('click', goToMenu);
    
    // Controles móveis
    document.getElementById('left-btn').addEventListener('touchstart', () => keys['ArrowLeft'] = true);
    document.getElementById('left-btn').addEventListener('touchend', () => keys['ArrowLeft'] = false);
    document.getElementById('right-btn').addEventListener('touchstart', () => keys['ArrowRight'] = true);
    document.getElementById('right-btn').addEventListener('touchend', () => keys['ArrowRight'] = false);
    document.getElementById('jump-btn').addEventListener('touchstart', () => keys[' '] = true);
    document.getElementById('jump-btn').addEventListener('touchend', () => keys[' '] = false);
    
    // Prevenir comportamento padrão do touch
    document.querySelectorAll('.control-btn').forEach(btn => {
        btn.addEventListener('touchstart', (e) => e.preventDefault());
        btn.addEventListener('touchend', (e) => e.preventDefault());
    });
});

// Controles do teclado
document.addEventListener('keydown', function(e) {
    keys[e.key] = true;
    
    // Prevenir scroll da página
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
    }
});

document.addEventListener('keyup', function(e) {
    keys[e.key] = false;
});

// Prevenir menu de contexto no canvas
document.getElementById('game-canvas').addEventListener('contextmenu', function(e) {
    e.preventDefault();
});

