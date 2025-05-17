// snake.js - Versão final com física e efeitos visuais

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
let snakeTracks = []; // Índices das músicas na cobra
let currentDirection = 'right';
let nextDirection = 'right';
let snake = [{ x: 5, y: 5, px: 5, py: 5, offsetY: 0 }]; // Posição inicial com física
let food = null; // Objeto da comida { x, y, trackIndex }
let score = 0;
let gameStarted = false;
let currentAudio = null; // Para controlar o preview de áudio
let currentTrackIndex = 0; // Índice da música tocando
let startTime = 0;
let moveInterval = 150; // Velocidade inicial (ms)
let grow = 0; // Contador de crescimento
let lastTime = 0; // Para animação suave
let accumulator = 0; // Acumulador de tempo para física

// Constantes de Grid e Tamanho
const gridSize = 20; // Número de células na largura/altura
const baseTileSize = 20; // Tamanho base de cada célula em pixels
const snakeTileSize = 20; // Tamanho dos segmentos da cobra
canvas.width = gridSize * baseTileSize;
canvas.height = gridSize * baseTileSize;

// Constantes de efeito físico
const PUSH_FORCE = 15; // Força de impulso quando come
const GRAVITY = 0.8; // Gravidade aplicada aos segmentos
const BOUNCE = 0.6; // Coeficiente de rebote

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

// Função shuffle para garantir ordem aleatória das músicas
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
    currentAudio.loop = true; // Loop para música contínua
    currentAudio.play().catch(e => console.error("Erro ao tocar áudio:", e));
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

    // 2. Construir a URL da API com timestamp para evitar cache
    const apiUrl = `/api/snake-tracks?period=${selectedPeriod}&shuffle=${Date.now()}`;
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

        // Embaralha as músicas para garantir ordem aleatória
        data = shuffleArray(data);
        console.log("Músicas embaralhadas para ordem aleatória");

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

    // Filtra índices de músicas que ainda não estão na cobra
    const available = tracks.map((_, i) => i).filter(i => !snakeTracks.includes(i));
    
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
        
        // Índice de música aleatório, priorizando músicas não usadas
        trackIndex = available.length > 0
            ? available[Math.floor(Math.random() * available.length)]
            : Math.floor(Math.random() * tracks.length);
            
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

// Função para verificar se comeu comida
function checkFood() {
    const head = snake[0];
    if (food && head.x === food.x && head.y === food.y) {
        // Pega a música correspondente à comida
        const track = tracks[food.trackIndex];
        
        // Toca a música
        if (track.preview) {
            playPreview(track.preview);
        }
        
        // Atualiza o display Now Playing
        updateNowPlaying(track);
        
        // Adiciona o índice da música ao início da lista de músicas da cobra
        snakeTracks.unshift(food.trackIndex);
        
        // Incrementa o contador de crescimento
        grow += 1;
        
        // Atualiza a pontuação
        score += 10;
        if (scoreSpan) scoreSpan.textContent = score;
        
        // Acelera o jogo
        moveInterval = Math.max(70, moveInterval * 0.98);
        
        // Aplica efeito de impulso em todos os segmentos
        snake.forEach(segment => {
            segment.offsetY += PUSH_FORCE;
        });
        
        // Gera nova comida
        food = generateFood();
    }
}

// Função para atualizar a física dos segmentos
function updatePhysics() {
    snake.forEach(segment => {
        if (segment.offsetY !== 0) {
            // Aplica gravidade
            segment.offsetY += GRAVITY;
            
            // Se estiver caindo (offsetY positivo), aplica rebote
            if (segment.offsetY > 0) {
                segment.offsetY *= -BOUNCE;
                
                // Se o movimento for muito pequeno, para completamente
                if (Math.abs(segment.offsetY) < 0.5) segment.offsetY = 0;
            }
        }
    });
}

// Função para atualizar a posição da cobra
function updateSnake() {
    // Vetores de direção
    const dx = { right: 1, left: -1, up: 0, down: 0 };
    const dy = { right: 0, left: 0, up: -1, down: 1 };

    // Atualiza a direção atual
    currentDirection = nextDirection;
    
    // Copia a cabeça atual
    const head = { ...snake[0] };
    
    // Cria nova cabeça com posição atualizada
    const newHead = {
        x: head.x + dx[currentDirection],
        y: head.y + dy[currentDirection],
        px: head.x, // Posição anterior X (para interpolação)
        py: head.y, // Posição anterior Y (para interpolação)
        offsetY: -PUSH_FORCE // Aplica impulso inicial na nova cabeça
    };
    
    // Adiciona a nova cabeça ao início da cobra
    snake.unshift(newHead);
    
    // Remove a cauda se não estiver crescendo
    if (grow > 0) {
        grow--;
    } else {
        snake.pop();
    }
}

// --- FUNÇÕES DE DESENHO ---

// Função para desenhar a cobra com interpolação e efeitos físicos
async function drawSnake(t) {
    for (let i = 0; i < snake.length; i++) {
        const s = snake[i];
        
        // Interpolação entre posição anterior e atual
        const tx = s.px + (s.x - s.px) * t;
        const ty = s.py + (s.y - s.py) * t;
        
        // Aplica o offset vertical (efeito de pulo)
        const yOffset = s.offsetY * Math.min(1, t * 2);
        
        // Obtém o índice da música para este segmento
        const trackIndex = snakeTracks[i] || 0;
        
        // Carrega a imagem da música
        const img = await loadImage(tracks[trackIndex].image);
        
        // Calcula o offset para centralização
        const offset = (baseTileSize - snakeTileSize) / 2;
        
        // Salva o contexto para transformações
        ctx.save();
        
        // Translada para a posição do segmento
        ctx.translate(
            tx * baseTileSize + baseTileSize/2,
            ty * baseTileSize + baseTileSize/2 + yOffset
        );
        
        // Aplica escala baseada no offset (efeito de esticar quando pula)
        const scale = 1 + Math.abs(yOffset)/150;
        ctx.scale(scale, scale);
        
        // Desenha a imagem centralizada
        ctx.drawImage(
            img,
            -snakeTileSize/2 + offset,
            -snakeTileSize/2 + offset,
            snakeTileSize,
            snakeTileSize
        );
        
        // Restaura o contexto
        ctx.restore();

        // Destaque especial para a cabeça
        if (i === 0) {
            ctx.strokeStyle = `rgba(255,255,255,${0.5 - Math.abs(yOffset)/100})`;
            ctx.lineWidth = 1;
            ctx.strokeRect(
                tx * baseTileSize + offset - 1,
                ty * baseTileSize + offset - 1 + yOffset,
                snakeTileSize + 2,
                snakeTileSize + 2
            );
        }
    }
}

// Função para desenhar a comida
async function drawFood() {
    if (!food) return;
    
    // Carrega a imagem da música
    const img = await loadImage(tracks[food.trackIndex].image);
    
    // Efeito de pulsação
    const pulse = Math.sin(Date.now() / 200) * 0.1 + 1;
    const size = baseTileSize * pulse;
    const offset = (baseTileSize - size) / 2;
    
    // Desenha a comida como um círculo
    ctx.save();
    ctx.beginPath();
    ctx.arc(
        food.x * baseTileSize + baseTileSize / 2,
        food.y * baseTileSize + baseTileSize / 2,
        size / 2,
        0,
        Math.PI * 2
    );
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, food.x * baseTileSize + offset, food.y * baseTileSize + offset, size, size);
    ctx.restore();
    
    // Desenha borda pulsante
    ctx.strokeStyle = `rgba(29, 185, 84, ${0.5 + Math.sin(Date.now() / 200) * 0.5})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(food.x * baseTileSize + offset, food.y * baseTileSize + offset, size, size);
}

// --- FUNÇÕES DE CONTROLE DO JOGO ---

function gameOver() {
    console.log("Game Over! Pontuação final:", score);
    gameStarted = false;
    stopPreview(); // Para a música
    
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

// Loop principal do jogo com física
async function gameLoop(timestamp) {
    if (!gameStarted) return;

    // Calcula o delta time
    const delta = timestamp - lastTime;
    lastTime = timestamp;
    
    // Acumula o tempo para a física
    accumulator += delta;

    // Atualiza a física dos segmentos
    updatePhysics();
    
    // Executa a lógica do jogo em intervalos fixos
    while (accumulator >= moveInterval) {
        // Verifica colisões
        if (checkCollision()) return gameOver();
        
        // Atualiza a posição da cobra
        updateSnake();
        
        // Verifica se comeu comida
        checkFood();
        
        // Reduz o acumulador
        accumulator -= moveInterval;
    }

    // Limpa o canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Desenha a cobra com interpolação
    await drawSnake(accumulator / moveInterval);
    
    // Desenha a comida
    await drawFood();
    
    // Atualiza o tempo de jogo
    timeElement.textContent = `Tempo: ${formatTime(Math.floor((Date.now() - startTime)/1000))}`;
    
    // Agenda o próximo frame
    requestAnimationFrame(gameLoop);
}

async function startGame() {
    if (gameStarted) return;
    
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
    
    // Reseta o jogo
    snake = [{ x: 5, y: 5, px: 5, py: 5, offsetY: 0 }];
    snakeTracks = [0]; // Começa com a primeira música
    currentDirection = nextDirection = 'right';
    score = 0;
    grow = 0;
    moveInterval = 150;
    
    if (scoreSpan) scoreSpan.textContent = '0';
    
    // Para qualquer áudio anterior
    stopPreview();
    
    // Inicia o timer
    startTime = Date.now();
    timeElement.textContent = 'Tempo: 00:00';
    
    // Toca a primeira música
    if (tracks[0].preview) {
        playPreview(tracks[0].preview);
    }
    
    // Atualiza o display Now Playing
    updateNowPlaying(tracks[0]);
    
    // Gera a primeira comida
    food = generateFood();
    
    // Inicia o loop do jogo
    gameStarted = true;
    lastTime = performance.now();
    accumulator = 0;
    requestAnimationFrame(gameLoop);
    
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
    
    // Mapeamento de teclas para direções
    const directions = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
        w: 'up',
        s: 'down',
        a: 'left',
        d: 'right',
        W: 'up',
        S: 'down',
        A: 'left',
        D: 'right'
    };
    
    // Obtém a nova direção
    const newDir = directions[e.key];
    if (!newDir) return;
    
    // Mapeamento de direções opostas
    const opposite = {
        up: 'down',
        down: 'up',
        left: 'right',
        right: 'left'
    };
    
    // Não permite voltar na direção oposta
    if (newDir !== opposite[currentDirection]) {
        nextDirection = newDir;
    }
}

// --- INICIALIZAÇÃO ---

// Adiciona event listeners
startButton.addEventListener('click', startGame);

// Adiciona listener de teclado
document.addEventListener('keydown', handleKeyDown);

// Inicializa o jogo (apenas prepara, não começa)
updateNowPlaying(null); // Limpa o display "Now Playing"

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

// Adiciona suporte aos botões de controle touch
document.addEventListener('DOMContentLoaded', function() {
    // Verifica se os elementos existem
    const touchUp = document.getElementById('touch-up');
    const touchDown = document.getElementById('touch-down');
    const touchLeft = document.getElementById('touch-left');
    const touchRight = document.getElementById('touch-right');
    
    if (touchUp) {
        touchUp.addEventListener('touchstart', function(e) {
            e.preventDefault();
            if (gameStarted && currentDirection !== 'down') nextDirection = 'up';
        });
    }
    
    if (touchDown) {
        touchDown.addEventListener('touchstart', function(e) {
            e.preventDefault();
            if (gameStarted && currentDirection !== 'up') nextDirection = 'down';
        });
    }
    
    if (touchLeft) {
        touchLeft.addEventListener('touchstart', function(e) {
            e.preventDefault();
            if (gameStarted && currentDirection !== 'right') nextDirection = 'left';
        });
    }
    
    if (touchRight) {
        touchRight.addEventListener('touchstart', function(e) {
            e.preventDefault();
            if (gameStarted && currentDirection !== 'left') nextDirection = 'right';
        });
    }
});

// Função para processar estatísticas do Last.fm
async function processLastfmStats(username) {
    if (!username) return;
    
    try {
        const statsContainer = document.getElementById('stats-container');
        const statsContent = document.getElementById('stats-content');
        
        if (!statsContainer || !statsContent) return;
        
        // Mostra feedback de carregamento
        statsContent.innerHTML = '<p>Carregando estatísticas...</p>';
        statsContainer.classList.add('active');
        
        // Busca estatísticas do Last.fm
        const response = await fetch(`/api/lastfm/stats?username=${encodeURIComponent(username)}`);
        
        if (!response.ok) {
            throw new Error(`Erro ao buscar estatísticas: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Verifica se há dados de top tracks
        if (!data.top_tracks || data.top_tracks.length === 0) {
            statsContent.innerHTML = '<p>Nenhuma estatística encontrada para este usuário.</p>';
            return;
        }
        
        // Renderiza as top tracks
        let html = '';
        
        data.top_tracks.forEach(track => {
            html += `
            <div class="stats-item">
                <img src="${track.image || 'https://via.placeholder.com/50?text=?'}" alt="${track.name}">
                <div class="stats-item-info">
                    <div class="stats-item-name">${track.name}</div>
                    <div class="stats-item-artist">${track.artist}</div>
                </div>
                <div class="stats-item-plays">${track.playcount}×</div>
            </div>`;
        });
        
        statsContent.innerHTML = html;
        statsContainer.classList.add('active');
        
    } catch (error) {
        console.error('Erro ao processar estatísticas do Last.fm:', error);
        const statsContent = document.getElementById('stats-content');
        if (statsContent) {
            statsContent.innerHTML = `<p>Erro ao carregar estatísticas: ${error.message}</p>`;
        }
    }
}

// Adiciona event listener para o formulário do Last.fm
document.addEventListener('DOMContentLoaded', function() {
    const lastfmForm = document.getElementById('lastfm-form');
    const lastfmSubmit = document.getElementById('lastfm-submit');
    const lastfmUsername = document.getElementById('lastfm-username');
    
    if (lastfmForm && lastfmSubmit && lastfmUsername) {
        lastfmSubmit.addEventListener('click', function(e) {
            e.preventDefault();
            const username = lastfmUsername.value.trim();
            if (username) {
                processLastfmStats(username);
                
                // Salva o username na sessão (opcional)
                fetch('/api/lastfm/save-username', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username })
                }).catch(err => console.error('Erro ao salvar username:', err));
            }
        });
        
        // Carrega username salvo (se existir)
        fetch('/api/lastfm/get-username')
            .then(res => res.json())
            .then(data => {
                if (data.has_username) {
                    lastfmUsername.value = data.username;
                    // Opcionalmente, carrega estatísticas automaticamente
                    processLastfmStats(data.username);
                }
            })
            .catch(err => console.error('Erro ao carregar username:', err));
    }
});
