# MNZ Snake - Jogo Snake com Integração Spotify, Deezer e Last.fm

Este projeto é uma adaptação do clássico jogo Snake que integra:
- **Autenticação com Spotify**: Para buscar as músicas favoritas do usuário
- **Reprodução via Deezer**: Para tocar previews das músicas durante o jogo
- **Estatísticas do Last.fm**: Para visualizar dados de escuta do usuário

## Requisitos

- Python 3.8+
- Conta no Spotify (para autenticação)
- Conta no Last.fm (opcional, para estatísticas)
- Credenciais de API (instruções abaixo)

## Configuração das APIs

### Spotify API
1. Acesse [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/)
2. Crie um novo aplicativo
3. Configure a URL de redirecionamento como `http://localhost:5000/callback/spotify`
4. Anote o Client ID e Client Secret

### Last.fm API
1. Acesse [Last.fm API](https://www.last.fm/api/account/create)
2. Crie uma conta de desenvolvedor e solicite uma API Key
3. Anote a API Key

## Instalação

1. Clone o repositório
2. Instale as dependências:
   ```
   pip install -r requirements.txt
   ```
3. Configure as variáveis de ambiente:
   ```
   export SPOTIFY_CLIENT_ID="seu_client_id"
   export SPOTIFY_CLIENT_SECRET="seu_client_secret"
   export LASTFM_API_KEY="sua_api_key"
   ```

## Executando o Projeto

1. Inicie o servidor Flask:
   ```
   cd snake_music_app
   python src/main.py
   ```
2. Acesse `http://localhost:5000` no navegador
3. Faça login com sua conta do Spotify
4. Selecione o período de músicas e inicie o jogo

## Como Jogar

- Use as setas do teclado ou deslize na tela (em dispositivos móveis) para controlar a cobra
- Cada "comida" representa uma música do seu top do Spotify
- Ao comer, a música tocará via Deezer e a cobra crescerá
- Insira seu nome de usuário do Last.fm para ver suas estatísticas

## Implantação na Web

Para implantar o projeto em um servidor web:

1. Configure as variáveis de ambiente no servidor
2. Atualize a URL de redirecionamento no Dashboard do Spotify para seu domínio
3. Use um servidor WSGI como Gunicorn:
   ```
   gunicorn -w 4 -b 0.0.0.0:5000 src.main:app
   ```
4. Configure um proxy reverso (Nginx/Apache) para servir a aplicação

## Estrutura do Projeto

```
snake_music_app/
├── src/
│   ├── main.py              # Ponto de entrada da aplicação
│   ├── routes/              # Rotas da API
│   │   ├── spotify.py       # Integração com Spotify
│   │   └── lastfm.py        # Integração com Last.fm
│   ├── static/              # Arquivos estáticos
│   │   ├── js/              # JavaScript
│   │   │   └── snake.js     # Lógica do jogo
│   │   └── images/          # Imagens
│   └── templates/           # Templates HTML
│       └── index.html       # Página principal
└── requirements.txt         # Dependências
```

## Personalização

- Modifique `src/templates/index.html` para alterar a aparência
- Ajuste `src/static/js/snake.js` para modificar a jogabilidade
- Explore outras APIs do Spotify e Last.fm para adicionar mais funcionalidades

## Solução de Problemas

- **Erro de autenticação**: Verifique se as credenciais do Spotify estão corretas
- **Músicas não carregam**: Confirme que sua conta do Spotify tem histórico de escuta
- **Previews não tocam**: Alguns países têm restrições de preview no Deezer
- **Estatísticas do Last.fm não aparecem**: Verifique se o nome de usuário está correto

## Créditos

- Jogo Snake original adaptado para integração com APIs de música
- Utiliza OAuth2 para autenticação segura com o Spotify
- Integração com Deezer para reprodução de previews
- Visualização de estatísticas via Last.fm API
