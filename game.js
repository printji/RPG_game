// 게임 변수들
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 게임 상태
let gameRunning = false;
let gameLoop;
let keys = {};

// 플레이어 클래스
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 40;
        this.speed = 5;
        this.hp = 100;
        this.maxHp = 100;
        this.attack = 15;
        this.level = 1;
        this.exp = 0;
        this.gold = 0;
        this.potions = 3;
        this.direction = 'down';
        this.animationFrame = 0;
        this.animationSpeed = 0.2;
    }

    update() {
        // 이동 처리 - 더 확실한 키 체크
        let newX = this.x;
        let newY = this.y;
        let isMoving = false;

        // WASD 키 체크
        if (keys['a']) {
            newX -= this.speed;
            this.direction = 'left';
            isMoving = true;
        }
        if (keys['d']) {
            newX += this.speed;
            this.direction = 'right';
            isMoving = true;
        }
        if (keys['w']) {
            newY -= this.speed;
            this.direction = 'up';
            isMoving = true;
        }
        if (keys['s']) {
            newY += this.speed;
            this.direction = 'down';
            isMoving = true;
        }

        // 월드 경계 체크 (캔버스 크기가 아닌 월드 크기 기준)
        if (newX >= 0 && newX <= WORLD_WIDTH - this.width) {
            this.x = newX;
        }
        if (newY >= 0 && newY <= WORLD_HEIGHT - this.height) {
            this.y = newY;
        }

        // 카메라 타겟 업데이트 (플레이어를 화면 중앙에 위치시키기 위해)
        camera.targetX = this.x + this.width/2 - canvas.width/2;
        camera.targetY = this.y + this.height/2 - canvas.height/2;

        // 애니메이션 업데이트
        this.animationFrame += this.animationSpeed;
    }

    draw() {
        // HP 바를 먼저 그리기 (캐릭터 아래에)
        this.drawHealthBar();
        
        // 캐릭터 그리기
        ctx.save();
        // 카메라 오프셋 적용
        ctx.translate(this.x + this.width/2 - camera.x, this.y + this.height/2 - camera.y);
        
        // 캐릭터 그리기 (귀여운 모양)
        ctx.fillStyle = '#FFB6C1'; // 핑크색
        ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
        
        // 얼굴
        ctx.fillStyle = '#FFF';
        ctx.fillRect(-15, -15, 30, 20);
        
        // 눈
        ctx.fillStyle = '#000';
        ctx.fillRect(-8, -10, 3, 3);
        ctx.fillRect(5, -10, 3, 3);
        
        // 입
        ctx.fillStyle = '#FF69B4';
        ctx.fillRect(-3, 2, 6, 2);
        
        // 방향에 따른 추가 디테일
        if (this.direction === 'left' || this.direction === 'right') {
            ctx.fillStyle = '#FFB6C1';
            ctx.fillRect(this.direction === 'left' ? -this.width/2 - 5 : this.width/2, -5, 5, 10);
        }
        
        ctx.restore();
    }

    drawHealthBar() {
        // 캐릭터 머리 위에 체력바 그리기 (카메라 오프셋 적용)
        const barWidth = this.width;
        const barHeight = 6;
        const x = this.x - camera.x;
        const y = this.y - camera.y - 15; // 머리 위쪽으로 더 올림
        
        // 배경 (빨간색)
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // HP (초록색)
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(x, y, (this.hp / this.maxHp) * barWidth, barHeight);
        
        // 테두리 (검은색)
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, barWidth, barHeight);
    }

    takeDamage(damage) {
        this.hp -= damage;
        if (this.hp < 0) this.hp = 0;
        updateUI();
    }

    heal(amount) {
        this.hp += amount;
        if (this.hp > this.maxHp) this.hp = this.maxHp;
        updateUI();
    }

    gainExp(amount) {
        this.exp += amount;
        const expNeeded = this.level * 40; // 레벨업이 더 빠르게 (50에서 40으로)
        if (this.exp >= expNeeded) {
            this.levelUp();
        }
        updateUI();
    }

    levelUp() {
        this.level++;
        this.exp = 0;
        this.maxHp += 30; // HP 증가량 증가
        this.hp = this.maxHp;
        this.attack += 8; // 공격력 증가량 증가
        this.speed += 0.5; // 속도도 약간 증가
        updateGameStatus(`🎉 레벨업! 레벨 ${this.level}이 되었습니다! HP +30, 공격력 +8!`);
    }

    gainGold(amount) {
        this.gold += amount;
        updateUI();
    }
}

// 몬스터 클래스
class Monster {
    constructor(x, y, type = 'slime') {
        this.x = x;
        this.y = y;
        this.width = 35;
        this.height = 35;
        this.type = type;
        this.hp = 30;
        this.maxHp = 30;
        this.attack = 3; // 8에서 3으로 약화
        this.goldReward = 10;
        this.expReward = 15;
        this.speed = 1;
        this.direction = Math.random() < 0.5 ? 1 : -1;
        this.moveTimer = 0;
        this.animationFrame = 0;
        
        // 공격 속도 시스템
        this.attackCooldown = 0;
        this.attackSpeed = 60; // 1초마다 공격 (60프레임 = 1초)
        this.lastAttackTime = 0;
        
        // 스킬 시스템
        this.skillCooldown = 0;
        this.skillSpeed = 180; // 3초마다 스킬 사용 (180프레임 = 3초)
        this.skills = [];
        this.initializeSkills(type);
        
        // 타입별 설정 (데미지 약화 + 공격속도)
        if (type === 'goblin') {
            this.hp = this.maxHp = 50;
            this.attack = 5; // 12에서 5로 약화
            this.attackSpeed = 45; // 더 빠른 공격속도
            this.skillSpeed = 120; // 2초마다 스킬
            this.goldReward = 20;
            this.expReward = 25;
        } else if (type === 'orc') {
            this.hp = this.maxHp = 80;
            this.attack = 8; // 18에서 8로 약화
            this.attackSpeed = 90; // 더 느린 공격속도
            this.skillSpeed = 240; // 4초마다 스킬
            this.goldReward = 35;
            this.expReward = 40;
        }
    }
    
    initializeSkills(type) {
        // 몬스터 타입별 스킬 초기화
        switch(type) {
            case 'slime':
                this.skills = ['poison_spit', 'jump_attack'];
                break;
            case 'goblin':
                this.skills = ['speed_boost', 'double_attack'];
                break;
            case 'orc':
                this.skills = ['ground_slam', 'berserker_rage'];
                break;
        }
    }

    update() {
        // 공격 쿨다운 업데이트
        if (this.attackCooldown > 0) {
            this.attackCooldown--;
        }
        
        // 스킬 쿨다운 업데이트
        if (this.skillCooldown > 0) {
            this.skillCooldown--;
        }
        
        // 간단한 AI: 플레이어를 향해 이동
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        if (distance > 0 && distance < 200) {
            const moveX = (dx / distance) * this.speed;
            const moveY = (dy / distance) * this.speed;
            
            this.x += moveX;
            this.y += moveY;
            
            // 월드 경계 체크
            if (this.x < 0) this.x = 0;
            if (this.x > WORLD_WIDTH - this.width) this.x = WORLD_WIDTH - this.width;
            if (this.y < 0) this.y = 0;
            if (this.y > WORLD_HEIGHT - this.height) this.y = WORLD_HEIGHT - this.height;
        }
        
        this.animationFrame += 0.1;
    }

    draw() {
        ctx.save();
        // 카메라 오프셋 적용
        ctx.translate(this.x + this.width/2 - camera.x, this.y + this.height/2 - camera.y);
        
        // 몬스터 타입별 그리기
        if (this.type === 'slime') {
            // 슬라임
            ctx.fillStyle = '#00FF00';
            ctx.beginPath();
            ctx.arc(0, 0, this.width/2, 0, Math.PI * 2);
            ctx.fill();
            
            // 눈
            ctx.fillStyle = '#000';
            ctx.fillRect(-8, -5, 3, 3);
            ctx.fillRect(5, -5, 3, 3);
        } else if (this.type === 'goblin') {
            // 고블린
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
            
            // 얼굴
            ctx.fillStyle = '#DEB887';
            ctx.fillRect(-12, -10, 24, 15);
            
            // 눈
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(-6, -8, 3, 3);
            ctx.fillRect(3, -8, 3, 3);
        } else if (this.type === 'orc') {
            // 오크
            ctx.fillStyle = '#228B22';
            ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
            
            // 얼굴
            ctx.fillStyle = '#90EE90';
            ctx.fillRect(-15, -12, 30, 18);
            
            // 눈
            ctx.fillStyle = '#000';
            ctx.fillRect(-8, -10, 4, 4);
            ctx.fillRect(4, -10, 4, 4);
            
            // 어금니
            ctx.fillStyle = '#FFF';
            ctx.fillRect(-5, 5, 3, 4);
            ctx.fillRect(2, 5, 3, 4);
        }
        
        ctx.restore();
        
        // HP 바
        this.drawHealthBar();
    }

    drawHealthBar() {
        const barWidth = this.width;
        const barHeight = 4;
        const x = this.x - camera.x;
        const y = this.y - camera.y - 8;
        
        // 배경
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // HP
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(x, y, (this.hp / this.maxHp) * barWidth, barHeight);
    }

    takeDamage(damage) {
        this.hp -= damage;
        return this.hp <= 0;
    }

    attackPlayer() {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        if (distance < 50 && this.attackCooldown <= 0) {
            this.attackCooldown = this.attackSpeed; // 쿨다운 설정
            player.takeDamage(this.attack);
            
            // 공격 이펙트 표시
            this.showAttackEffect();
            
            return true;
        }
        return false;
    }
    
    showAttackEffect() {
        // 공격 이펙트 (빨간 원)
        ctx.save();
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(this.x + this.width/2 - camera.x, this.y + this.height/2 - camera.y, 25, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
    
    useSkill() {
        if (this.skillCooldown <= 0 && Math.random() < 0.01) { // 1% 확률로 스킬 사용
            this.skillCooldown = this.skillSpeed;
            const skill = this.skills[Math.floor(Math.random() * this.skills.length)];
            this.executeSkill(skill);
        }
    }
    
    executeSkill(skillName) {
        switch(skillName) {
            case 'poison_spit':
                this.poisonSpit();
                break;
            case 'jump_attack':
                this.jumpAttack();
                break;
            case 'speed_boost':
                this.speedBoost();
                break;
            case 'double_attack':
                this.doubleAttack();
                break;
            case 'ground_slam':
                this.groundSlam();
                break;
            case 'berserker_rage':
                this.berserkerRage();
                break;
        }
    }
    
    poisonSpit() {
        // 독 침 뱉기 - 원거리 공격
        updateGameStatus(`🐸 ${this.type}이 독 침을 뱉었습니다!`);
        // 독 이펙트
        ctx.save();
        ctx.fillStyle = '#00FF00';
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(this.x + this.width/2 - camera.x, this.y + this.height/2 - camera.y, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    
    jumpAttack() {
        // 점프 공격 - 강한 데미지
        updateGameStatus(`🐸 ${this.type}이 점프 공격을 사용했습니다!`);
        player.takeDamage(this.attack * 2);
        // 점프 이펙트
        this.showJumpEffect();
    }
    
    speedBoost() {
        // 속도 증가
        updateGameStatus(`🏃 ${this.type}이 속도를 증가시켰습니다!`);
        this.speed *= 2;
        setTimeout(() => { this.speed /= 2; }, 3000); // 3초 후 원래대로
    }
    
    doubleAttack() {
        // 이중 공격
        updateGameStatus(`⚔️ ${this.type}이 이중 공격을 사용했습니다!`);
        player.takeDamage(this.attack);
        player.takeDamage(this.attack);
    }
    
    groundSlam() {
        // 지면 강타 - 범위 공격
        updateGameStatus(`💥 ${this.type}이 지면을 강타했습니다!`);
        // 범위 데미지 이펙트
        ctx.save();
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 5;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(this.x + this.width/2 - camera.x, this.y + this.height/2 - camera.y, 60, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        
        // 범위 내 플레이어에게 데미지
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        if (distance < 60) {
            player.takeDamage(this.attack * 1.5);
        }
    }
    
    berserkerRage() {
        // 광폭화 - 공격력 증가
        updateGameStatus(`😡 ${this.type}이 광폭화했습니다!`);
        this.attack *= 1.5;
        setTimeout(() => { this.attack /= 1.5; }, 5000); // 5초 후 원래대로
    }
    
    showJumpEffect() {
        // 점프 이펙트
        ctx.save();
        ctx.strokeStyle = '#FFFF00';
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(this.x + this.width/2 - camera.x, this.y + this.height/2 - camera.y - 20, 30, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

// 아이템 클래스
class Item {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 20;
        this.type = type;
        this.collected = false;
    }

    draw() {
        if (this.collected) return;
        
        ctx.save();
        // 카메라 오프셋 적용
        ctx.translate(this.x + this.width/2 - camera.x, this.y + this.height/2 - camera.y);
        
        if (this.type === 'potion') {
            // 포션
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
            ctx.fillStyle = '#FFF';
            ctx.fillRect(-this.width/2 + 2, -this.height/2 + 2, this.width - 4, this.height - 4);
        } else if (this.type === 'gold') {
            // 골드
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(0, 0, this.width/2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }

    checkCollision(player) {
        if (this.collected) return false;
        
        return player.x < this.x + this.width &&
               player.x + player.width > this.x &&
               player.y < this.y + this.height &&
               player.y + player.height > this.y;
    }

    collect(player) {
        this.collected = true;
        if (this.type === 'potion') {
            player.potions++;
            updateGameStatus('🧪 포션을 획득했습니다!');
        } else if (this.type === 'gold') {
            player.gainGold(5);
            updateGameStatus('💰 골드를 획득했습니다!');
        }
    }
}

// 게임 객체들
let player;
let monsters = [];
let items = [];
let gameTime = 0;
let attackEffectTimer = 0;
let gamePaused = false; // 게임 일시정지 상태

// 카메라 시스템
let camera = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    smoothSpeed: 0.1
};

// 월드 크기 (캔버스보다 큰 월드)
const WORLD_WIDTH = 1600;
const WORLD_HEIGHT = 1200;

// 게임 초기화
function initGame() {
    // 플레이어를 월드 정중앙에 배치
    player = new Player(WORLD_WIDTH/2 - 20, WORLD_HEIGHT/2 - 20);
    monsters = [];
    items = [];
    gameTime = 0;
    
    // 카메라 초기화 - 플레이어가 화면 중앙에 오도록 설정
    camera.x = WORLD_WIDTH/2 - canvas.width/2;
    camera.y = WORLD_HEIGHT/2 - canvas.height/2;
    camera.targetX = camera.x;
    camera.targetY = camera.y;
    
    // 초기 몬스터 생성 (더 많이!)
    for (let i = 0; i < 8; i++) {
        spawnMonster();
    }
    
    // 초기 아이템 생성
    spawnItem('potion');
    spawnItem('gold');
    
    updateUI();
    updateGameStatus('게임이 시작되었습니다! 몬스터를 물리치고 레벨업하세요!');
}

// 몬스터 생성
function spawnMonster() {
    const types = ['slime', 'goblin', 'orc'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let x, y;
    do {
        x = Math.random() * (WORLD_WIDTH - 35);
        y = Math.random() * (WORLD_HEIGHT - 35);
    } while (Math.abs(x - player.x) < 100 && Math.abs(y - player.y) < 100);
    
    monsters.push(new Monster(x, y, type));
}

// 아이템 생성
function spawnItem(type) {
    const x = Math.random() * (WORLD_WIDTH - 20);
    const y = Math.random() * (WORLD_HEIGHT - 20);
    items.push(new Item(x, y, type));
}

// 카메라 업데이트
function updateCamera() {
    // 부드러운 카메라 움직임
    camera.x += (camera.targetX - camera.x) * camera.smoothSpeed;
    camera.y += (camera.targetY - camera.y) * camera.smoothSpeed;
    
    // 카메라 경계 제한
    camera.x = Math.max(0, Math.min(camera.x, WORLD_WIDTH - canvas.width));
    camera.y = Math.max(0, Math.min(camera.y, WORLD_HEIGHT - canvas.height));
}

// 게임 루프
function gameUpdate() {
    if (!gameRunning || gamePaused) return; // 일시정지 상태일 때 게임 업데이트 중단
    
    // 카메라 업데이트
    updateCamera();
    
    // 화면 지우기
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 플레이어 업데이트 및 그리기
    player.update();
    player.draw();
    
    // 몬스터들 업데이트 및 그리기
    monsters.forEach((monster, index) => {
        monster.update();
        monster.draw();
        
        // 플레이어와의 충돌 체크
        if (Math.abs(player.x - monster.x) < 40 && 
            Math.abs(player.y - monster.y) < 40) {
            // 전투 처리
            if (monster.attackPlayer()) {
                updateGameStatus(`💥 ${monster.type}에게 공격당했습니다!`);
            }
        }
        
        // 스킬 사용 체크
        monster.useSkill();
    });
    
    // 아이템들 처리
    items.forEach(item => {
        item.draw();
        if (item.checkCollision(player)) {
            item.collect(player);
        }
    });
    
    // 공격 이펙트 그리기
    drawAttackEffect();
    
    // 게임 시간 증가
    gameTime += 1/60;
    
    // 공격 이펙트 타이머 감소
    if (attackEffectTimer > 0) {
        attackEffectTimer -= 1/60;
    }
    
    // 주기적으로 몬스터와 아이템 생성 (더 자주, 더 많이!)
    if (gameTime % 5 < 1/60) { // 10초에서 5초로 단축
        // 2-3마리씩 몬스터 생성
        const spawnCount = Math.floor(Math.random() * 2) + 2;
        for (let i = 0; i < spawnCount; i++) {
            spawnMonster();
        }
        
        // 아이템도 더 자주 생성
        if (Math.random() < 0.6) { // 30%에서 60%로 증가
            spawnItem(Math.random() < 0.5 ? 'potion' : 'gold');
        }
    }
    
    // 게임 오버 체크
    if (player.hp <= 0) {
        gameOver();
    }
}

// 게임 시작
function startGame() {
    if (gameRunning) return;
    
    gameRunning = true;
    initGame();
    
    gameLoop = setInterval(gameUpdate, 1000/60);
    updateGameStatus('게임이 시작되었습니다! WASD로 이동하세요!');
}

// 게임 오버
function gameOver() {
    gameRunning = false;
    clearInterval(gameLoop);
    updateGameStatus(`💀 게임 오버! 레벨 ${player.level}까지 달성했습니다!`);
}

// 범위 공격 함수 - 주변 모든 적을 공격
function attack() {
    if (!gameRunning) return;
    
    const attackRange = 120; // 공격 범위를 크게 증가 (기존 60에서 120으로)
    let hitCount = 0;
    let totalDamage = 0;
    
    // 공격 이펙트 타이머 설정 (0.5초간 표시)
    attackEffectTimer = 0.5;
    
    // 역순으로 순회하여 안전하게 제거
    for (let i = monsters.length - 1; i >= 0; i--) {
        const monster = monsters[i];
        const dx = player.x + player.width/2 - (monster.x + monster.width/2);
        const dy = player.y + player.height/2 - (monster.y + monster.height/2);
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        if (distance < attackRange) {
            const isDead = monster.takeDamage(player.attack);
            totalDamage += player.attack;
            hitCount++;
            
            if (isDead) {
                player.gainExp(monster.expReward);
                player.gainGold(monster.goldReward);
                monsters.splice(i, 1);
                
                // 새로운 몬스터 생성 (더 많이!)
                setTimeout(() => {
                    const newSpawnCount = Math.floor(Math.random() * 2) + 1;
                    for (let i = 0; i < newSpawnCount; i++) {
                        spawnMonster();
                    }
                }, 1000);
            }
        }
    }
    
    if (hitCount > 0) {
        updateGameStatus(`⚔️ 범위 공격! ${hitCount}마리에게 총 ${totalDamage} 데미지!`);
    } else {
        updateGameStatus(`⚔️ 공격 범위 내에 적이 없습니다!`);
    }
}

// 공격 이펙트 그리기
function drawAttackEffect() {
    if (attackEffectTimer <= 0) return;
    
    ctx.save();
    
    const alpha = attackEffectTimer / 0.5; // 시간에 따라 투명도 감소
    const scale = 1 + (1 - alpha) * 0.5; // 시간에 따라 크기 증가
    
    // 공격 범위 표시 (반투명 원) - 카메라 오프셋 적용
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 3;
    ctx.globalAlpha = alpha * 0.7;
    ctx.beginPath();
    ctx.arc(player.x + player.width/2 - camera.x, player.y + player.height/2 - camera.y, 120 * scale, 0, Math.PI * 2);
    ctx.stroke();
    
    // 공격 파티클 효과
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const startX = player.x + player.width/2 - camera.x;
        const startY = player.y + player.height/2 - camera.y;
        const endX = startX + Math.cos(angle) * 120 * scale;
        const endY = startY + Math.sin(angle) * 120 * scale;
        
        ctx.strokeStyle = '#FFFF00';
        ctx.lineWidth = 2;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    }
    
    ctx.globalAlpha = 1;
    ctx.restore();
}

// 포션 사용
function usePotion() {
    if (!gameRunning) return;
    
    if (player.potions > 0) {
        player.potions--;
        player.heal(30);
        updateGameStatus('🧪 포션을 사용했습니다!');
    } else {
        updateGameStatus('포션이 없습니다!');
    }
}

// 게임 리셋
function resetGame() {
    gameRunning = false;
    if (gameLoop) clearInterval(gameLoop);
    initGame();
    updateGameStatus('게임을 다시 시작하세요!');
}

// 상점 열기
function openShop() {
    gamePaused = true; // 게임 일시정지
    document.getElementById('shopModal').style.display = 'block';
    updateGameStatus('🛍️ 상점이 열렸습니다. 게임이 일시정지되었습니다.');
}

// 상점 닫기
function closeShop() {
    gamePaused = false; // 게임 재개
    document.getElementById('shopModal').style.display = 'none';
    updateGameStatus('게임이 재개되었습니다!');
}

// 상점 아이템 구매
function buyItem(itemType) {
    const shopItems = {
        'healing_potion': { price: 30, name: '힐링 포션' },
        'attack_upgrade': { price: 100, name: '공격력 강화' },
        'hp_upgrade': { price: 80, name: '최대 HP 증가' },
        'speed_upgrade': { price: 120, name: '이동속도 증가' },
        'super_potion': { price: 50, name: '특별 포션' }
    };
    
    const item = shopItems[itemType];
    if (!item) return;
    
    if (player.gold >= item.price) {
        player.gold -= item.price;
        
        switch (itemType) {
            case 'healing_potion':
                player.heal(50);
                updateGameStatus(`🧪 힐링 포션을 구매했습니다! HP +50`);
                break;
            case 'attack_upgrade':
                player.attack += 5;
                updateGameStatus(`⚔️ 공격력 강화! 공격력 +5 (현재: ${player.attack})`);
                break;
            case 'hp_upgrade':
                player.maxHp += 25;
                player.hp += 25; // 현재 HP도 증가
                updateGameStatus(`❤️ 최대 HP 증가! HP +25 (최대: ${player.maxHp})`);
                break;
            case 'speed_upgrade':
                player.speed += 1;
                updateGameStatus(`🏃 이동속도 증가! 속도 +1 (현재: ${player.speed})`);
                break;
            case 'super_potion':
                player.hp = player.maxHp;
                updateGameStatus(`💎 특별 포션! HP가 완전히 회복되었습니다!`);
                break;
        }
        
        updateUI();
    } else {
        updateGameStatus(`💰 골드가 부족합니다! 필요: ${item.price}골드, 보유: ${player.gold}골드`);
    }
}

// UI 업데이트
function updateUI() {
    document.getElementById('playerHP').textContent = player.hp;
    document.getElementById('playerAttack').textContent = player.attack;
    document.getElementById('playerGold').textContent = player.gold;
    document.getElementById('playerLevel').textContent = player.level;
    document.getElementById('playerPotions').textContent = player.potions;
}

// 게임 상태 업데이트
function updateGameStatus(message) {
    document.getElementById('gameStatus').textContent = message;
}

// 키보드 이벤트 처리 - 완전히 새로 작성
document.addEventListener('keydown', (e) => {
    console.log('키 눌림:', e.key);
    
    // 모든 가능한 키 조합 처리
    if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        keys['w'] = true;
    }
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        keys['a'] = true;
    }
    if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
        keys['s'] = true;
    }
    if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        keys['d'] = true;
    }
    if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        attack();
    }
    if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        usePotion();
    }
    if (e.key === 'Escape') {
        closeShop();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        keys['w'] = false;
    }
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        keys['a'] = false;
    }
    if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
        keys['s'] = false;
    }
    if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        keys['d'] = false;
    }
});

// 마우스 이벤트 처리
canvas.addEventListener('click', function(e) {
    // 좌클릭으로 공격
    attack();
});

// 모달 외부 클릭시 닫기
window.onclick = function(event) {
    const modal = document.getElementById('shopModal');
    if (event.target === modal) {
        closeShop();
    }
}

// 게임 초기화
initGame();

