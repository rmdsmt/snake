// snake.js - Versão adaptada com movimentação suave e rápida

// --- SELEÇÃO DE ELEMENTOS DO DOM ---
const canvas = document.getElementById('snake-canvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const scoreSpan = scoreElement.querySelector('span');
const timeElement = document.getElementById('time');
const startButton = document.getElementById('start-btn');
const nowPlayingElement = document.getElementById('now-playing');
const nowPlayingArt = document.getElementById('now-playing-art');
const nowPlayingTrack = document.getElementById('now-playing-track');
const nowPlayingArtist = document.getElementById('now-playing-artist');

// --- VARIÁVEIS GLOBAIS DO JOGO ---
let tracks = []; // Lista de músicas da API
let snake = [{ x: 5, y: 5, visualX: 5, visualY: 5 }]; // Posição inicial da cobra com coordenadas visuais
let snakeBodyInfo = [0]; // Array para guardar o índice da música de cada segmento da cobra
let currentDirection = 'right';
let nextDirection = 'right';
let food = null; // Objeto da comida { x, y, trackIndex }
let score = 0;
let gameStarted = false;
let currentAudio = null; // Para controlar o preview de áudio
let currentTrackIndex = 0; // Índice da música tocando
let startTime = 0;
let gameLoopTimeout = null; // Para controlar o loop com setTimeout
let timerInterval = null; // Para o timer de tempo de jogo
let lastUpdateTime = 0; // Para animação suave
let animationSpeed = 0.4; // Velocidade da animação (aumentada para movimento mais rápido)

// Constantes de Grid e Tamanho
const gridSize = 20; // Número de células na largura/altura
const tileSize = 20; // Tamanho de cada célula em pixels
canvas.width = gridSize * tileSize;
canvas.height = gridSize * tileSize;

// Constantes de aceleração
const INITIAL_INTERVAL = 180; // Velocidade inicial (ms) - ajustada para ser mais rápida
const MIN_INTERVAL = 80; // Velocidade máxima (ms) - ajustada para ser mais rápida
const ACCELERATION_FACTOR = 0.98; // Quanto mais perto de 1, mais lenta a aceleração
let moveInterval = INITIAL_INTERVAL; // Velocidade atual

// Cache de Imagens e Fallback
const imageCache = new Map();
const fallbackImage = new Image();
fallbackImage.src = 'https://via.placeholder.com/50?text=?'; // Usar placeholder como fallback

// --- FUNÇÕES UTILITÁRIAS ---

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Função shuffle
function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// Função para carregar imagem com cache
async function loadImage(url) {
  if (!url) return fallbackImage; // Retorna fallback se URL for nula/vazia
  if (imageCache.has(url)) return imageCache.get(url);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous'; // Necessário para alguns CDNs
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => {
       console.warn(`Falha ao carregar imagem: ${url}. Usando fallback.`);
      // Não armazena fallback no cache com URL original para tentar carregar de novo depois
      resolve(fallbackImage);
    };
    img.src = url;
  });
}

// --- FUNÇÕES DE CONTROLE DE ÁUDIO ---

function playPreview(previewUrl) {
  stopPreview(); // Para a música anterior antes de tocar a nova
  if (previewUrl) {
    currentAudio = new Audio(previewUrl);
    currentAudio.volume = 0.4; // Ajuste o volume
    currentAudio.play().catch(e => console.error("Erro ao tocar áudio:", e));
    // Não usar loop para previews curtos
  }
}

function stopPreview() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

// --- FUNÇÃO PARA ATUALIZAR O DISPLAY "NOW PLAYING" ---

function updateNowPlaying(trackData) {
  const dynamicBg = document.getElementById('dynamic-background');
  
  if (trackData && trackData.name && trackData.artist) {
      loadImage(trackData.image || fallbackImage.src).then(img => {
          nowPlayingArt.src = img.src;
          
          // Atualiza o fundo com a capa do álbum
          if (dynamicBg) {
              dynamicBg.style.backgroundImage = `url(${img.src})`;
          }
      });
      
      nowPlayingTrack.textContent = trackData.name;
      nowPlayingArtist.textContent = trackData.artist;
      nowPlayingElement.classList.add('active');
  } else {
      nowPlayingArt.src = fallbackImage.src;
      nowPlayingTrack.textContent = "Nenhuma música";
      nowPlayingArtist.textContent = "Escolha e Inicie!";
      nowPlayingElement.classList.remove('active');
      
      // Reseta o fundo se não houver música
      if (dynamicBg) {
          dynamicBg.style.backgroundImage = '';
      }
  }
}

// --- FUNÇÃO PARA BUSCAR MÚSICAS DA API ---

async function fetchTracks() {
    // 1. Ler o período selecionado no HTML
    const selectedPeriodInput = document.querySelector('input[name="period"]:checked');
    const selectedPeriod = selectedPeriodInput ? selectedPeriodInput.value : '12month'; // Padrão: 12month
    console.log(`>>> [Frontend] Enviando período para API: ${selectedPeriod}`); // Log

    // 2. Construir a URL da API
    const apiUrl = `/api/snake-tracks?period=${selectedPeriod}`;
    console.log('Fetching tracks from:', apiUrl);

    // 3. Feedback visual durante o carregamento
    startButton.disabled = true;
    startButton.textContent = 'Carregando...';
    updateNowPlaying({ name: "Buscando Músicas...", artist: `Período: ${selectedPeriod}` });

    try {
        const res = await fetch(apiUrl);
        if (!res.ok) {
            let errorMsg = `Erro ${res.status}`;
            try {
                const errorData = await res.json();
                errorMsg = errorData.details || errorData.error || `Falha ao carregar músicas (${res.status})`;
            } catch (e) { /* Ignora se não for JSON */ }
            throw new Error(errorMsg);
        }
        let data = await res.json();

        // Filtra tracks sem imagem válida (opcional, mas recomendado)
        data = data.filter(track => track.image && !track.image.includes('placeholder'));
        console.log(`Recebidas ${data.length} músicas válidas da API.`);

        if (data.length < 5) { // Precisa de um mínimo para jogar
            throw new Error(`Poucas músicas (${data.length}) encontradas para jogar.`);
        }

        // Pré-carrega imagens (opcional, mas melhora performance visual)
        await Promise.all(data.map(track => loadImage(track.image)));

        // Retorna as músicas válidas
        return data;

    } catch (error) {
        console.error('Erro ao carregar ou processar músicas:', error);
        updateNowPlaying({ name: "Erro ao Carregar", artist: error.message });
        startButton.disabled = false;
        startButton.textContent = 'Tentar Novamente';
        return []; // Retorna array vazio em caso de erro
    }
}

// --- FUNÇÕES DE LÓGICA DO JOGO ---

function generateFood() {
    if (!tracks || tracks.length === 0) {
        console.error("Não há músicas carregadas para gerar comida.");
        return null;
    }

    let newFoodPosition;
    let trackIndex;
    let attempts = 0;
    const maxAttempts = 100; // Evitar loop infinito se a cobra ocupar tudo

    do {
        // Posição aleatória
        newFoodPosition = {
            x: Math.floor(Math.random() * gridSize),
            y: Math.floor(Math.random() * gridSize),
        };
        // Índice de música aleatório
        trackIndex = Math.floor(Math.random() * tracks.length);
        attempts++;
    } while (attempts < maxAttempts && snake.some(segment => segment.x === newFoodPosition.x && segment.y === newFoodPosition.y));

    if (attempts >= maxAttempts) {
        console.warn("Não foi possível encontrar posição para a comida.");
        return null; // Não conseguiu gerar
    }

    console.log(`Comida gerada em (${newFoodPosition.x}, ${newFoodPosition.y}) com música: ${tracks[trackIndex].name}`);
    return { ...newFoodPosition, trackIndex }; // Retorna posição e índice da música
}

function checkCollision() {
    const head = snake[0];

    // Colisão com paredes
    if (head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize) {
        return true;
    }

    // Colisão com o corpo (ignora a própria cabeça)
    for (let i = 1; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            return true;
        }
    }
    return false;
}

// Função para atualizar as coordenadas visuais (animação suave)
function updateVisualPositions(deltaTime) {
    // Usa um loop separado para garantir que a cabeça seja atualizada primeiro
    // Isso cria um efeito de "onda" mais natural no movimento da cobra
    
    // Primeiro atualiza a cabeça
    const head = snake[0];
    const dx = head.x - head.visualX;
    const dy = head.y - head.visualY;
    
    // Atualiza posição visual com interpolação suave
    head.visualX += dx * animationSpeed * deltaTime;
    head.visualY += dy * animationSpeed * deltaTime;
    
    // Depois atualiza o resto do corpo com um pequeno atraso
    for (let i = 1; i < snake.length; i++) {
        const segment = snake[i];
        const prevSegment = snake[i-1];
        
        // Segue o segmento anterior com um pequeno atraso
        const targetX = prevSegment.visualX;
        const targetY = prevSegment.visualY;
        
        // Calcula a diferença entre posição atual e alvo
        const dx = targetX - segment.visualX;
        const dy = targetY - segment.visualY;
        
        // Atualiza posição visual com interpolação suave
        // Segmentos mais próximos da cabeça se movem mais rápido
        const speedFactor = 1 - (i / (snake.length * 2));
        segment.visualX += dx * animationSpeed * deltaTime * speedFactor;
        segment.visualY += dy * animationSpeed * deltaTime * speedFactor;
    }
}

function updateGame() {
    if (!gameStarted) return;

    // --- Movimento da Cobra ---
    const head = { ...snake[0] }; // Copia a cabeça atual
    currentDirection = nextDirection; // Atualiza a direção ANTES de mover

    switch (currentDirection) {
        case 'up': head.y -= 1; break;
        case 'down': head.y += 1; break;
        case 'left': head.x -= 1; break;
        case 'right': head.x += 1; break;
    }

    // Adiciona coordenadas visuais iguais às reais para a nova cabeça
    head.visualX = snake[0].x; // Usa a posição anterior da cabeça como ponto de partida
    head.visualY = snake[0].y; // Isso cria um efeito mais suave

    // --- Verifica Colisões ---
    // Colisão com paredes
    if (head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize) {
        gameOver();
        return;
    }
    
    // Colisão com o corpo (ignora a própria cabeça que ainda não foi adicionada)
    for (let i = 0; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            gameOver();
            return; // Já colidiu
        }
    }

    // Adiciona a nova cabeça
    snake.unshift(head);

    // --- Verifica se comeu a comida ---
    if (food && head.x === food.x && head.y === food.y) {
        score += 10;
        if (scoreSpan) scoreSpan.textContent = score; // Atualiza o span do score

        const eatenTrack = tracks[food.trackIndex];
        updateNowPlaying(eatenTrack); // ATUALIZA O DISPLAY
        playPreview(eatenTrack?.preview); // TOCA O PREVIEW

        // Adiciona a info da track comida ao corpo da cobra
        snakeBodyInfo.unshift(food.trackIndex);

        // Acelera o jogo
        moveInterval = Math.max(MIN_INTERVAL, moveInterval * ACCELERATION_FACTOR);

        food = generateFood(); // Gera nova comida

        // Cobra cresceu, não remove a cauda
    } else {
        // Cobra não comeu, remove a cauda para dar efeito de movimento
        snake.pop();
        // Remove também a informação do último segmento
        if (snakeBodyInfo.length > snake.length) {
           snakeBodyInfo.pop();
        }
    }

    // Agenda o próximo passo do jogo
    clearTimeout(gameLoopTimeout); // Limpa timeout anterior
    gameLoopTimeout = setTimeout(updateGame, moveInterval); // Agenda o próximo
}

// --- FUNÇÕES DE DESENHO ---

async function drawGame(timestamp) {
    if (!ctx) return; // Não desenha se não tem contexto

    // Calcula o delta time para animação suave
    if (!lastUpdateTime) lastUpdateTime = timestamp;
    const deltaTime = (timestamp - lastUpdateTime) / (1000 / 60); // Normaliza para 60fps
    lastUpdateTime = timestamp;

    // Atualiza posições visuais para animação suave
    if (gameStarted) {
        updateVisualPositions(deltaTime);
    }

    // Limpa o canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Desenha a comida primeiro (para a cobra ficar por cima)
    if (food) {
        try {
            const foodTrack = tracks[food.trackIndex];
            if (foodTrack) {
                const img = await loadImage(foodTrack.image);
                const pulse = Math.sin(Date.now() / 200) * 0.1 + 1; // Efeito de pulsação
                const size = tileSize * pulse;
                const offset = (tileSize - size) / 2;

                // Desenha imagem circular
                ctx.save();
                ctx.beginPath();
                ctx.arc(
                    food.x * tileSize + tileSize / 2,
                    food.y * tileSize + tileSize / 2,
                    size / 2, // Raio
                    0, Math.PI * 2
                );
                ctx.closePath();
                ctx.clip(); // Aplica o clip circular
                ctx.drawImage(img, food.x * tileSize + offset, food.y * tileSize + offset, size, size);
                ctx.restore(); // Remove o clip

                // Desenha borda pulsante
                ctx.strokeStyle = `rgba(29, 185, 84, ${0.5 + Math.sin(Date.now() / 200) * 0.5})`;
                ctx.lineWidth = 2;
                // Ajuste para desenhar a borda no retângulo que contém o círculo
                ctx.strokeRect(food.x * tileSize + offset, food.y * tileSize + offset, size, size);
            } else {
                console.warn(`Track não encontrada para comida no índice ${food.trackIndex}`);
                // Desenha fallback se track não existir
                ctx.fillStyle = 'red';
                ctx.fillRect(food.x * tileSize, food.y * tileSize, tileSize, tileSize);
            }
        } catch(error) {
            console.error("Erro ao desenhar comida:", error);
            ctx.fillStyle = 'red'; // Fallback visual
            ctx.fillRect(food.x * tileSize, food.y * tileSize, tileSize, tileSize);
        }
    }

    // Desenha a cobra com posições visuais (animação suave)
    for (let i = 0; i < snake.length; i++) {
        const segment = snake[i];
        const trackIndex = snakeBodyInfo[i] !== undefined ? snakeBodyInfo[i] : 0; // Pega info do corpo ou usa 0

        try {
            const segmentTrack = tracks[trackIndex];
            if (segmentTrack) {
                const img = await loadImage(segmentTrack.image);
                
                // Usa as coordenadas visuais para desenho suave
                ctx.drawImage(
                    img, 
                    Math.round(segment.visualX * tileSize), // Arredonda para evitar desenho borrado
                    Math.round(segment.visualY * tileSize), 
                    tileSize, 
                    tileSize
                );

                // Adiciona destaque na cabeça
                if (i === 0) {
                    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; // Cor mais visível
                    ctx.lineWidth = 2; // Linha mais grossa
                    ctx.strokeRect(
                        Math.round(segment.visualX * tileSize), 
                        Math.round(segment.visualY * tileSize), 
                        tileSize, 
                        tileSize
                    );
                }
            } else {
                console.warn(`Track não encontrada para segmento da cobra no índice ${trackIndex}`);
                ctx.fillStyle = i === 0 ? '#1DB954' : '#1ed760'; // Cor fallback
                ctx.fillRect(
                    Math.round(segment.visualX * tileSize), 
                    Math.round(segment.visualY * tileSize), 
                    tileSize, 
                    tileSize
                );
            }
        } catch(error) {
            console.error("Erro ao desenhar segmento da cobra:", error);
            ctx.fillStyle = i === 0 ? '#1DB954' : '#1ed760'; // Cor fallback
            ctx.fillRect(
                Math.round(segment.visualX * tileSize), 
                Math.round(segment.visualY * tileSize), 
                tileSize, 
                tileSize
            );
        }
    }

    // Chama o próximo frame de desenho
    requestAnimationFrame(drawGame);
}

// --- FUNÇÕES DE CONTROLE DO JOGO ---

function gameOver() {
    console.log("Game Over! Pontuação final:", score);
    gameStarted = false;
    stopPreview(); // Para a música
    clearTimeout(gameLoopTimeout); // Para o loop de lógica
    clearInterval(timerInterval); // Para o timer de tempo
    updateNowPlaying(null); // Limpa o display "Now Playing"
    document.removeEventListener('keydown', handleKeyDown); // Remove listener de teclado

    // Adicionar mensagem visual de Game Over no canvas
    setTimeout(() => { // Pequeno delay para garantir que o último frame foi limpo
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '30px Montserrat';
        ctx.textAlign = 'center';
        ctx.fillText('Fim de Jogo!', canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = '20px Poppins';
        ctx.fillText(`Pontuação: ${score}`, canvas.width / 2, canvas.height / 2 + 20);
        ctx.font = '16px Poppins';
        ctx.fillText('Pressione "Iniciar" para jogar novamente', canvas.width / 2, canvas.height / 2 + 60);
    }, 50); // 50ms delay

    startButton.disabled = false; // Permite reiniciar
    startButton.textContent = 'Jogar Novamente';
}

function startGame() {
    if (gameStarted) return; // Evita iniciar múltiplas vezes

    // Reseta o jogo
    snake = [{ x: 5, y: 5, visualX: 5, visualY: 5 }];
    snakeBodyInfo = [0];
    currentDirection = 'right';
    nextDirection = 'right';
    score = 0;
    moveInterval = INITIAL_INTERVAL;
    lastUpdateTime = 0;
    
    if (scoreSpan) scoreSpan.textContent = '0';
    
    // Inicia o timer
    startTime = Date.now();
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        timeElement.textContent = `Tempo: ${formatTime(elapsedSeconds)}`;
    }, 1000);
    
    // Gera a primeira comida
    food = generateFood();
    
    // Inicia o loop do jogo
    gameStarted = true;
    updateGame();
    requestAnimationFrame(drawGame);
    
    // Adiciona listener de teclado
    document.addEventListener('keydown', handleKeyDown);
    
    // Atualiza o botão
    startButton.disabled = true;
    startButton.textContent = 'Jogando...';
    
    console.log('Jogo iniciado!');
}

function handleKeyDown(e) {
    if (!gameStarted) return;
    
    // Previne que as setas rolem a página
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
    }
    
    // Atualiza a direção baseado na tecla pressionada
    // Não permite voltar na direção oposta (isso mataria a cobra instantaneamente)
    switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            if (currentDirection !== 'down') nextDirection = 'up';
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            if (currentDirection !== 'up') nextDirection = 'down';
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            if (currentDirection !== 'right') nextDirection = 'left';
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            if (currentDirection !== 'left') nextDirection = 'right';
            break;
    }
}

// --- INICIALIZAÇÃO ---

// Adiciona event listeners
startButton.addEventListener('click', async () => {
    if (gameStarted) return; // Não faz nada se já estiver jogando
    
    startButton.disabled = true;
    startButton.textContent = 'Carregando...';
    
    // Busca as músicas se ainda não tiver
    if (!tracks || tracks.length === 0) {
        tracks = await fetchTracks();
        
        if (tracks.length === 0) {
            startButton.disabled = false;
            startButton.textContent = 'Tentar Novamente';
            return; // Não inicia o jogo se não tiver músicas
        }
    }
    
    // Inicia o jogo
    startGame();
});

// Inicializa o jogo (apenas prepara, não começa)
updateNowPlaying(null); // Limpa o display "Now Playing"
requestAnimationFrame(drawGame); // Inicia o loop de desenho

// Adiciona suporte a touch para dispositivos móveis
let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener('touchstart', function(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    e.preventDefault(); // Previne comportamento padrão (scroll, zoom)
}, { passive: false });

canvas.addEventListener('touchmove', function(e) {
    if (!gameStarted) return;
    
    const touchEndX = e.touches[0].clientX;
    const touchEndY = e.touches[0].clientY;
    
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;
    
    // Determina a direção do swipe baseado na maior diferença
    // Aumenta o limite mínimo para evitar movimentos acidentais
    const minSwipeDistance = 10;
    
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > minSwipeDistance) {
        // Swipe horizontal
        if (diffX > 0 && currentDirection !== 'left') {
            nextDirection = 'right';
        } else if (diffX < 0 && currentDirection !== 'right') {
            nextDirection = 'left';
        }
    } else if (Math.abs(diffY) > minSwipeDistance) {
        // Swipe vertical
        if (diffY > 0 && currentDirection !== 'up') {
            nextDirection = 'down';
        } else if (diffY < 0 && currentDirection !== 'down') {
            nextDirection = 'up';
        }
    }
    
    // Atualiza o ponto de início para o próximo movimento
    touchStartX = touchEndX;
    touchStartY = touchEndY;
    
    e.preventDefault(); // Previne comportamento padrão
}, { passive: false });

// Adiciona suporte a toque no botão de iniciar para dispositivos móveis
startButton.addEventListener('touchstart', function(e) {
    e.preventDefault(); // Previne comportamento padrão
    this.click(); // Simula um clique
}, { passive: false });
