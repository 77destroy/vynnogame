// Конфигурация игры Phaser
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    backgroundColor: '#000033',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

// Инициализация игры
const game = new Phaser.Game(config);

let player;
let cursors;
let enemies;
let bullets;
let score = 0;
let scoreText;
let lives = 3;
let livesText;
let gameOver = false;
let canShoot = true;

function preload() {
    // Создаем простые геометрические формы как спрайты
    this.add.graphics()
        .fillStyle(0x00ff00)
        .fillRect(0, 0, 50, 30)
        .generateTexture('player', 50, 30);
    
    this.add.graphics()
        .fillStyle(0xff0000)
        .fillCircle(0, 0, 15)
        .generateTexture('enemy', 30, 30);
    
    this.add.graphics()
        .fillStyle(0xffff00)
        .fillCircle(0, 0, 5)
        .generateTexture('bullet', 10, 10);
}

function create() {
    // Создаем игрока
    player = this.physics.add.image(100, config.height / 2, 'player');
    player.setCollideWorldBounds(true);
    
    // Управление
    cursors = this.input.keyboard.createCursorKeys();
    
    // Группы для врагов и пуль
    enemies = this.physics.add.group();
    bullets = this.physics.add.group();
    
    // Текст счета
    scoreText = this.add.text(16, 16, 'Счет: 0', {
        fontSize: '32px',
        fill: '#fff'
    });
    
    // Текст жизней
    livesText = this.add.text(16, 60, 'Жизни: 3', {
        fontSize: '32px',
        fill: '#ff0000'
    });
    
    // Создаем врагов каждые 2 секунды
    this.time.addEvent({
        delay: 2000,
        callback: spawnEnemy,
        callbackScope: this,
        loop: true
    });
    
    // Коллизии: пули с врагами
    this.physics.add.overlap(bullets, enemies, hitEnemy, null, this);
    
    // Коллизии: игрок с врагами
    this.physics.add.overlap(player, enemies, hitPlayer, null, this);
}

function update() {
    if (gameOver) {
        return;
    }
    
    // Управление игроком
    if (cursors.up.isDown) {
        player.setVelocityY(-300);
    } else if (cursors.down.isDown) {
        player.setVelocityY(300);
    } else {
        player.setVelocityY(0);
    }
    
    // Стрельба
    if (cursors.space.isDown && canShoot) {
        shoot();
        canShoot = false;
        this.time.delayedCall(300, () => {
            canShoot = true;
        });
    }
    
    // Перемещаем врагов влево
    enemies.children.entries.forEach(enemy => {
        enemy.x -= 200 * (this.game.loop.delta / 1000);
        
        // Удаляем врагов за экраном
        if (enemy.x < -50) {
            enemy.destroy();
        }
    });
    
    // Перемещаем пули вправо
    bullets.children.entries.forEach(bullet => {
        bullet.x += 600 * (this.game.loop.delta / 1000);
        
        // Удаляем пули за экраном
        if (bullet.x > config.width + 50) {
            bullet.destroy();
        }
    });
}

function shoot() {
    const bullet = bullets.create(player.x + 30, player.y, 'bullet');
    bullet.body.setVelocityX(600);
}

function spawnEnemy() {
    if (gameOver) return;
    
    const y = Phaser.Math.Between(50, config.height - 50);
    const enemy = enemies.create(config.width + 50, y, 'enemy');
    enemy.body.setVelocityX(-200);
    enemy.setCollideWorldBounds(false);
}

function hitEnemy(bullet, enemy) {
    bullet.destroy();
    enemy.destroy();
    
    score += 10;
    scoreText.setText('Счет: ' + score);
    
    // Отправляем счет в Telegram (если запущено в Telegram)
    if (window.TelegramWebApp) {
        window.TelegramWebApp.HapticFeedback.impactOccurred('medium');
    }
}

function hitPlayer(player, enemy) {
    enemy.destroy();
    
    lives--;
    livesText.setText('Жизни: ' + lives);
    
    if (window.TelegramWebApp) {
        window.TelegramWebApp.HapticFeedback.impactOccurred('heavy');
    }
    
    if (lives <= 0) {
        gameOverScreen();
    }
}

function gameOverScreen() {
    gameOver = true;
    
    // Отправляем финальный счет в Telegram
    if (window.TelegramWebApp) {
        const initData = window.TelegramWebApp.initData;
        
        // Создаем URL для отправки счета
        const gameUrl = window.location.href;
        const scoreData = {
            user_id: window.TelegramWebApp.initDataUnsafe?.user?.id,
            score: score
        };
        
        // Можно использовать Telegram Bot API для сохранения счета
        fetch(window.location.origin + '/game_score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scoreData)
        }).catch(err => console.log('Не удалось отправить счет'));
    }
    
    // Скрываем игрока
    player.setVisible(false);
    
    // Текст Game Over
    this.add.text(config.width / 2, config.height / 2 - 50, 'GAME OVER', {
        fontSize: '64px',
        fill: '#ff0000',
        align: 'center'
    }).setOrigin(0.5);
    
    this.add.text(config.width / 2, config.height / 2 + 50, 'Финальный счет: ' + score, {
        fontSize: '32px',
        fill: '#fff',
        align: 'center'
    }).setOrigin(0.5);
    
    this.add.text(config.width / 2, config.height / 2 + 100, 'Обновите страницу для новой игры', {
        fontSize: '24px',
        fill: '#ffff00',
        align: 'center'
    }).setOrigin(0.5);
}

// Для мобильных устройств - touch управление
document.addEventListener('DOMContentLoaded', function() {
    if ('ontouchstart' in window || navigator.maxTouchPoints) {
        const gameContainer = document.getElementById('game-container');
        
        // Создаем кнопки управления
        const controls = document.createElement('div');
        controls.style.cssText = 'position: absolute; bottom: 20px; width: 100%; display: flex; justify-content: center; gap: 20px;';
        
        // Кнопка вверх
        const upBtn = document.createElement('button');
        upBtn.innerHTML = '↑';
        upBtn.style.cssText = 'width: 60px; height: 60px; font-size: 30px; background: rgba(255,255,255,0.3); border: none; border-radius: 10px;';
        
        // Кнопка вниз
        const downBtn = document.createElement('button');
        downBtn.innerHTML = '↓';
        downBtn.style.cssText = 'width: 60px; height: 60px; font-size: 30px; background: rgba(255,255,255,0.3); border: none; border-radius: 10px;';
        
        // Кнопка стрельбы
        const shootBtn = document.createElement('button');
        shootBtn.innerHTML = '⚡';
        shootBtn.style.cssText = 'width: 80px; height: 60px; font-size: 30px; background: rgba(255,0,0,0.5); border: none; border-radius: 10px;';
        
        controls.appendChild(upBtn);
        controls.appendChild(shootBtn);
        controls.appendChild(downBtn);
        
        gameContainer.style.position = 'relative';
        gameContainer.appendChild(controls);
        
        // Назначаем события
        upBtn.addEventListener('touchstart', () => {
            if (cursors) cursors.up.isDown = true;
        });
        upBtn.addEventListener('touchend', () => {
            if (cursors) cursors.up.isDown = false;
        });
        
        downBtn.addEventListener('touchstart', () => {
            if (cursors) cursors.down.isDown = true;
        });
        downBtn.addEventListener('touchend', () => {
            if (cursors) cursors.down.isDown = false;
        });
        
        shootBtn.addEventListener('touchstart', () => {
            if (cursors && canShoot) {
                canShoot = false;
                cursors.space.isDown = true;
                setTimeout(() => {
                    cursors.space.isDown = false;
                    canShoot = true;
                }, 300);
            }
        });
    }
});
