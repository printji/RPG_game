// 게임 변수들
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 게임 상태
let gameRunning = false;
let gameLoop;
let keys = {};

// 도감 시스템
let monsterDex = {
    slime: { discovered: false, defeated: 0, skills: ['poison_spit', 'jump_attack'] },
    goblin: { discovered: false, defeated: 0, skills: ['speed_boost', 'double_attack'] },
    orc: { discovered: false, defeated: 0, skills: ['ground_slam', 'berserker_rage'] }
};

let bossDex = {
    dragon: { discovered: false, defeated: 0, skills: ['fire_breath', 'wing_attack', 'dragon_roar'] }
};

// 보스 시스템
let bossTimer = 0;
const BOSS_SPAWN_INTERVAL = 3600; // 60초 * 60프레임 = 1분
let currentBoss = null;

// 투사체 시스템
let projectiles = [];

// 시각 효과
let visualEffects = [];

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
        
        // 도감 업데이트
        if (!monsterDex[type].discovered) {
            monsterDex[type].discovered = true;
        }
        
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
        if (this.hp <= 0) {
            // 도감 업데이트
            monsterDex[this.type].defeated++;
        }
        return this.hp <= 0;
    }
    
    getMonsterName() {
        const names = {
            slime: '슬라임',
            goblin: '고블린',
            orc: '오크'
        };
        return names[this.type] || this.type;
    }
    
    getSkillName(skill) {
        const skillNames = {
            poison_spit: '독 침 뱉기',
            jump_attack: '점프 공격',
            speed_boost: '속도 증가',
            double_attack: '이중 공격',
            ground_slam: '지면 강타',
            berserker_rage: '광폭화'
        };
        return skillNames[skill] || skill;
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
        // 화면에 보이는 몬스터만 스킬 사용
        if (!this.isOnScreen()) return;
        
        if (this.skillCooldown <= 0 && Math.random() < 0.01) { // 1% 확률로 스킬 사용
            this.skillCooldown = this.skillSpeed;
            const skill = this.skills[Math.floor(Math.random() * this.skills.length)];
            this.executeSkill(skill);
        }
    }
    
    isOnScreen() {
        // 몬스터가 화면에 보이는지 체크
        const screenLeft = camera.x;
        const screenRight = camera.x + canvas.width;
        const screenTop = camera.y;
        const screenBottom = camera.y + canvas.height;
        
        return this.x < screenRight && 
               this.x + this.width > screenLeft && 
               this.y < screenBottom && 
               this.y + this.height > screenTop;
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
        player.takeDamage(this.attack * 2);
        // 점프 이펙트
        this.showJumpEffect();
    }
    
    speedBoost() {
        // 속도 증가
        this.speed *= 2;
        setTimeout(() => { this.speed /= 2; }, 3000); // 3초 후 원래대로
    }
    
    doubleAttack() {
        // 이중 공격
        player.takeDamage(this.attack);
        player.takeDamage(this.attack);
    }
    
    groundSlam() {
        // 지면 강타 - 범위 공격
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

// 보스 생성
function spawnBoss() {
    if (currentBoss) return; // 이미 보스가 있으면 생성하지 않음
    
    let x, y;
    do {
        x = Math.random() * (WORLD_WIDTH - 80);
        y = Math.random() * (WORLD_HEIGHT - 80);
    } while (Math.abs(x - player.x) < 200 && Math.abs(y - player.y) < 200);
    
    currentBoss = new Boss(x, y);
}

// 충돌 체크 함수
function checkCollision(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width &&
           obj1.x + obj1.width > obj2.x &&
           obj1.y < obj2.y + obj2.height &&
           obj1.y + obj1.height > obj2.y;
}

// 가장 가까운 몬스터 찾기
function findNearestMonster() {
    let nearest = null;
    let nearestDistance = Infinity;
    
    // 몬스터들 중에서 가장 가까운 것 찾기
    monsters.forEach(monster => {
        const dx = monster.x - player.x;
        const dy = monster.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = monster;
        }
    });
    
    // 보스가 있으면 보스와도 비교
    if (currentBoss) {
        const dx = currentBoss.x - player.x;
        const dy = currentBoss.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < nearestDistance) {
            nearest = currentBoss;
        }
    }
    
    return nearest;
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
    for (let i = monsters.length - 1; i >= 0; i--) {
        const monster = monsters[i];
        monster.update();
        monster.draw();
        
        // 플레이어와의 충돌 체크
        if (Math.abs(player.x - monster.x) < 40 && 
            Math.abs(player.y - monster.y) < 40) {
            // 전투 처리
            if (monster.attackPlayer()) {
                updateGameStatus(`💥 ${monster.getMonsterName()}에게 공격당했습니다!`);
            }
        }
        
        // 스킬 사용 체크
        monster.useSkill();
        
        // 몬스터가 죽었는지 체크
        if (monster.hp <= 0) {
            monsters.splice(i, 1);
        }
    }
    
    // 보스 업데이트 및 그리기
    if (currentBoss) {
        currentBoss.update();
        currentBoss.draw();
        
        // 보스와 플레이어 충돌 체크
        if (Math.abs(player.x - currentBoss.x) < 60 && 
            Math.abs(player.y - currentBoss.y) < 60) {
            if (currentBoss.attackPlayer()) {
                updateGameStatus(`💥 ${currentBoss.getBossName()}에게 공격당했습니다!`);
            }
        }
        
        // 보스 스킬 사용
        currentBoss.useSkill();
        
        if (currentBoss.hp <= 0) {
            currentBoss = null;
        }
    }
    
    // 보스 타이머 업데이트
    bossTimer++;
    if (bossTimer >= BOSS_SPAWN_INTERVAL && !currentBoss) {
        spawnBoss();
        bossTimer = 0;
    }
    
    // 투사체 업데이트 및 그리기
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        projectile.update();
        projectile.draw();
        
        // 투사체와 몬스터 충돌 체크
        for (let j = monsters.length - 1; j >= 0; j--) {
            const monster = monsters[j];
            if (checkCollision(projectile, monster)) {
                monster.takeDamage(projectile.damage);
                visualEffects.push(new VisualEffect(monster.x, monster.y, 'hit'));
                projectiles.splice(i, 1);
                break;
            }
        }
        
        // 투사체와 보스 충돌 체크
        if (currentBoss && checkCollision(projectile, currentBoss)) {
            currentBoss.takeDamage(projectile.damage);
            visualEffects.push(new VisualEffect(currentBoss.x, currentBoss.y, 'hit'));
            projectiles.splice(i, 1);
        }
        
        // 투사체 생명체크
        if (!projectile.isAlive()) {
            projectiles.splice(i, 1);
        }
    }
    
    // 시각 효과 업데이트 및 그리기
    for (let i = visualEffects.length - 1; i >= 0; i--) {
        const effect = visualEffects[i];
        effect.update();
        effect.draw();
        if (!effect.isAlive()) {
            visualEffects.splice(i, 1);
        }
    }
    
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
}

// 게임 오버
function gameOver() {
    gameRunning = false;
    clearInterval(gameLoop);
}

// 타겟팅 공격 함수 - 가장 가까운 적에게 투사체 발사
function attack() {
    if (!gameRunning) return;
    
    const target = findNearestMonster();
    
    if (target) {
        // 가장 가까운 적에게 투사체 발사
        const playerCenterX = player.x + player.width/2;
        const playerCenterY = player.y + player.height/2;
        const targetCenterX = target.x + target.width/2;
        const targetCenterY = target.y + target.height/2;
        
        const projectile = new Projectile(playerCenterX, playerCenterY, targetCenterX, targetCenterY, player.attack);
        projectiles.push(projectile);
        
        // 공격 이펙트
        attackEffectTimer = 0.5;
        visualEffects.push(new VisualEffect(playerCenterX, playerCenterY, 'attack'));
        
        const targetName = target.getMonsterName ? target.getMonsterName() : target.getBossName();
    }
}

// 범위 공격 함수 (기존 코드 유지 - 다른 곳에서 사용할 수 있음)
function areaAttack() {
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
    }
}

// 게임 리셋
function resetGame() {
    gameRunning = false;
    if (gameLoop) clearInterval(gameLoop);
    initGame();
}

// 상점 열기
function openShop() {
    gamePaused = true; // 게임 일시정지
    document.getElementById('shopModal').style.display = 'block';
}

// 상점 닫기
function closeShop() {
    gamePaused = false; // 게임 재개
    document.getElementById('shopModal').style.display = 'none';
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
                break;
            case 'attack_upgrade':
                player.attack += 5;
                break;
            case 'hp_upgrade':
                player.maxHp += 25;
                player.hp += 25; // 현재 HP도 증가
                break;
            case 'speed_upgrade':
                player.speed += 1;
                break;
            case 'super_potion':
                player.hp = player.maxHp;
                break;
        }
        
        updateUI();
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

// 보스 클래스
class Boss {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 80;
        this.height = 80;
        this.type = 'dragon';
        this.hp = 500;
        this.maxHp = 500;
        this.attack = 25;
        this.goldReward = 200;
        this.expReward = 150;
        this.speed = 2;
        this.animationFrame = 0;
        
        // 공격 속도 시스템
        this.attackCooldown = 0;
        this.attackSpeed = 120; // 2초마다 공격
        
        // 스킬 시스템
        this.skillCooldown = 0;
        this.skillSpeed = 300; // 5초마다 스킬
        this.skills = ['fire_breath', 'wing_attack', 'dragon_roar'];
        
        // 도감 업데이트
        if (!bossDex[this.type].discovered) {
            bossDex[this.type].discovered = true;
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
        
        // 플레이어를 향해 이동
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        if (distance > 0) {
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
        ctx.translate(this.x + this.width/2 - camera.x, this.y + this.height/2 - camera.y);
        
        // 드래곤 그리기
        ctx.fillStyle = '#8B0000'; // 진한 빨간색
        ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
        
        // 날개
        ctx.fillStyle = '#FF4500'; // 주황빨강
        ctx.fillRect(-this.width/2 - 10, -this.height/4, 15, this.height/2);
        ctx.fillRect(this.width/2 - 5, -this.height/4, 15, this.height/2);
        
        // 머리
        ctx.fillStyle = '#DC143C'; // 진한 빨강
        ctx.fillRect(-15, -25, 30, 20);
        
        // 눈
        ctx.fillStyle = '#FFD700'; // 금색
        ctx.fillRect(-8, -20, 4, 4);
        ctx.fillRect(4, -20, 4, 4);
        
        // 보스 표시
        ctx.fillStyle = '#FF0000';
        ctx.font = 'bold 12px Arial';
        ctx.fillText('BOSS', -20, -40);
        
        ctx.restore();
        
        // HP 바 (더 큰 바)
        this.drawHealthBar();
    }
    
    drawHealthBar() {
        const barWidth = this.width + 20;
        const barHeight = 8;
        const x = this.x - camera.x - 10;
        const y = this.y - camera.y - 20;
        
        // 배경
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // HP
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(x, y, (this.hp / this.maxHp) * barWidth, barHeight);
        
        // 테두리
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, barWidth, barHeight);
        
        // HP 텍스트
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 10px Arial';
        ctx.fillText(`${this.hp}/${this.maxHp}`, x + barWidth/2 - 20, y + barHeight + 12);
    }
    
    takeDamage(damage) {
        this.hp -= damage;
        if (this.hp <= 0) {
            // 도감 업데이트
            bossDex[this.type].defeated++;
            player.gainExp(this.expReward);
            player.gainGold(this.goldReward);
            currentBoss = null;
        }
        return this.hp <= 0;
    }
    
    attackPlayer() {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        if (distance < 80 && this.attackCooldown <= 0) {
            this.attackCooldown = this.attackSpeed;
            player.takeDamage(this.attack);
            
            // 보스 공격 이펙트
            this.showBossAttackEffect();
            
            return true;
        }
        return false;
    }
    
    showBossAttackEffect() {
        // 보스 공격 이펙트 (더 큰 빨간 원)
        ctx.save();
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 5;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(this.x + this.width/2 - camera.x, this.y + this.height/2 - camera.y, 40, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
    
    useSkill() {
        if (this.skillCooldown <= 0 && Math.random() < 0.02) { // 2% 확률로 스킬 사용
            this.skillCooldown = this.skillSpeed;
            const skill = this.skills[Math.floor(Math.random() * this.skills.length)];
            this.executeBossSkill(skill);
        }
    }
    
    executeBossSkill(skill) {
        switch(skill) {
            case 'fire_breath':
                player.takeDamage(15);
                this.showFireBreathEffect();
                break;
            case 'wing_attack':
                player.takeDamage(20);
                this.showWingAttackEffect();
                break;
            case 'dragon_roar':
                player.takeDamage(10);
                this.attack += 5;
                this.speed += 1;
                break;
        }
    }
    
    showFireBreathEffect() {
        // 불꽃 숨결 이펙트
        ctx.save();
        ctx.fillStyle = '#FF4500';
        ctx.globalAlpha = 0.7;
        ctx.fillRect(this.x - camera.x, this.y - camera.y, this.width * 2, this.height);
        ctx.restore();
    }
    
    showWingAttackEffect() {
        // 날개 공격 이펙트
        ctx.save();
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 8;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(this.x + this.width/2 - camera.x, this.y + this.height/2 - camera.y, 60, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
    
    getBossName() {
        return '드래곤';
    }
    
    getSkillName(skill) {
        const skillNames = {
            fire_breath: '불꽃 숨결',
            wing_attack: '날개 공격',
            dragon_roar: '드래곤 포효'
        };
        return skillNames[skill] || skill;
    }
}

// 투사체 클래스
class Projectile {
    constructor(x, y, targetX, targetY, damage) {
        this.x = x;
        this.y = y;
        this.targetX = targetX;
        this.targetY = targetY;
        this.damage = damage;
        this.speed = 8;
        this.width = 8;
        this.height = 8;
        
        // 방향 계산
        const dx = targetX - x;
        const dy = targetY - y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        this.velocityX = (dx / distance) * this.speed;
        this.velocityY = (dy / distance) * this.speed;
        
        this.life = 60; // 1초 후 사라짐
    }
    
    update() {
        this.x += this.velocityX;
        this.y += this.velocityY;
        this.life--;
        
        // 월드 경계 체크
        if (this.x < 0 || this.x > WORLD_WIDTH || this.y < 0 || this.y > WORLD_HEIGHT) {
            this.life = 0;
        }
    }
    
    draw() {
        ctx.save();
        ctx.fillStyle = '#FFD700'; // 금색 총알
        ctx.shadowColor = '#FFA500';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(this.x - camera.x, this.y - camera.y, this.width/2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    
    isAlive() {
        return this.life > 0;
    }
}

// 시각 효과 클래스
class VisualEffect {
    constructor(x, y, type, duration = 30) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.duration = duration;
        this.life = duration;
    }
    
    update() {
        this.life--;
    }
    
    draw() {
        if (this.type === 'hit') {
            ctx.save();
            ctx.fillStyle = '#FF0000';
            ctx.globalAlpha = this.life / this.duration;
            ctx.font = 'bold 24px Arial';
            ctx.shadowColor = '#FF0000';
            ctx.shadowBlur = 10;
            ctx.fillText('HIT!', this.x - camera.x, this.y - camera.y);
            ctx.restore();
        } else if (this.type === 'attack') {
            ctx.save();
            ctx.fillStyle = '#FFD700';
            ctx.globalAlpha = this.life / this.duration;
            ctx.font = 'bold 20px Arial';
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 8;
            ctx.fillText('⚔️', this.x - camera.x, this.y - camera.y);
            ctx.restore();
        }
    }
    
    isAlive() {
        return this.life > 0;
    }
}

// 몬스터 도감 열기
function openMonsterDex() {
    gamePaused = true;
    document.getElementById('monsterDexModal').style.display = 'block';
    updateMonsterDexContent();
}

// 몬스터 도감 닫기
function closeMonsterDex() {
    gamePaused = false;
    document.getElementById('monsterDexModal').style.display = 'none';
}

// 보스 도감 열기
function openBossDex() {
    gamePaused = true;
    document.getElementById('bossDexModal').style.display = 'block';
    updateBossDexContent();
}

// 보스 도감 닫기
function closeBossDex() {
    gamePaused = false;
    document.getElementById('bossDexModal').style.display = 'none';
}

// 몬스터 도감 내용 업데이트
function updateMonsterDexContent() {
    const content = document.getElementById('monsterDexContent');
    let html = '';
    
    Object.keys(monsterDex).forEach(monsterType => {
        const dex = monsterDex[monsterType];
        const monsterName = getMonsterDisplayName(monsterType);
        const discovered = dex.discovered ? '✅' : '❓';
        
        html += `
            <div class="shop-item">
                <div class="item-info">
                    <h3>${discovered} ${monsterName}</h3>
                    <p>처치 횟수: ${dex.defeated}마리</p>
                    <p>스킬: ${dex.skills.map(skill => getSkillDisplayName(skill)).join(', ')}</p>
                    ${!dex.discovered ? '<p style="color: #999;">아직 발견하지 못했습니다.</p>' : ''}
                </div>
            </div>
        `;
    });
    
    content.innerHTML = html;
}

// 보스 도감 내용 업데이트
function updateBossDexContent() {
    const content = document.getElementById('bossDexContent');
    let html = '';
    
    Object.keys(bossDex).forEach(bossType => {
        const dex = bossDex[bossType];
        const bossName = getBossDisplayName(bossType);
        const discovered = dex.discovered ? '✅' : '❓';
        
        html += `
            <div class="shop-item">
                <div class="item-info">
                    <h3>${discovered} ${bossName}</h3>
                    <p>처치 횟수: ${dex.defeated}마리</p>
                    <p>스킬: ${dex.skills.map(skill => getBossSkillDisplayName(skill)).join(', ')}</p>
                    ${!dex.discovered ? '<p style="color: #999;">아직 발견하지 못했습니다.</p>' : ''}
                </div>
            </div>
        `;
    });
    
    content.innerHTML = html;
}

// 몬스터 표시 이름 가져오기
function getMonsterDisplayName(type) {
    const names = {
        slime: '🐸 슬라임',
        goblin: '🏃 고블린',
        orc: '😡 오크'
    };
    return names[type] || type;
}

// 보스 표시 이름 가져오기
function getBossDisplayName(type) {
    const names = {
        dragon: '🐉 드래곤'
    };
    return names[type] || type;
}

// 스킬 표시 이름 가져오기
function getSkillDisplayName(skill) {
    const names = {
        poison_spit: '독 침 뱉기',
        jump_attack: '점프 공격',
        speed_boost: '속도 증가',
        double_attack: '이중 공격',
        ground_slam: '지면 강타',
        berserker_rage: '광폭화'
    };
    return names[skill] || skill;
}

// 보스 스킬 표시 이름 가져오기
function getBossSkillDisplayName(skill) {
    const names = {
        fire_breath: '불꽃 숨결',
        wing_attack: '날개 공격',
        dragon_roar: '드래곤 포효'
    };
    return names[skill] || skill;
}

// 게임 초기화
initGame();

