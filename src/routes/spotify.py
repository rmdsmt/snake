from flask import Blueprint, redirect, request, session, url_for, jsonify
from requests_oauthlib import OAuth2Session
import os
import requests

spotify_bp = Blueprint('spotify', __name__)

# Configurações do Spotify
SPOTIFY_CLIENT_ID = os.getenv('SPOTIFY_CLIENT_ID', '')
SPOTIFY_CLIENT_SECRET = os.getenv('SPOTIFY_CLIENT_SECRET', '')
SPOTIFY_REDIRECT_URI = os.getenv('SPOTIFY_REDIRECT_URI', 'http://localhost:5000/callback/spotify')
SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize'
SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1/'
SPOTIFY_SCOPE = 'user-read-private user-top-read user-read-email'

# Rota para iniciar o fluxo de autenticação do Spotify
@spotify_bp.route('/login/spotify')
def spotify_login():
    spotify = OAuth2Session(SPOTIFY_CLIENT_ID, scope=SPOTIFY_SCOPE, redirect_uri=SPOTIFY_REDIRECT_URI)
    authorization_url, state = spotify.authorization_url(SPOTIFY_AUTH_URL)
    
    # Armazena o state para validação posterior
    session['oauth_state'] = state
    
    return redirect(authorization_url)

# Rota de callback do Spotify
@spotify_bp.route('/callback/spotify')
def spotify_callback():
    spotify = OAuth2Session(SPOTIFY_CLIENT_ID, redirect_uri=SPOTIFY_REDIRECT_URI, state=session.get('oauth_state'))
    
    try:
        # Obtém o token de acesso
        token = spotify.fetch_token(
            SPOTIFY_TOKEN_URL,
            client_secret=SPOTIFY_CLIENT_SECRET,
            authorization_response=request.url
        )
        
        # Armazena o token na sessão
        session['spotify_token'] = token
        
        # Obtém informações do usuário
        user_info = spotify.get(SPOTIFY_API_BASE_URL + 'me').json()
        session['user_id'] = user_info.get('id')
        session['user_name'] = user_info.get('display_name')
        session['user_image'] = user_info.get('images')[0]['url'] if user_info.get('images') else ''
        
        return redirect('/')
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# Rota para verificar o status de autenticação
@spotify_bp.route('/auth/status')
def auth_status():
    is_authenticated = 'spotify_token' in session
    user_name = session.get('user_name', '')
    user_image = session.get('user_image', '')
    
    return jsonify({
        "authenticated": is_authenticated,
        "user_name": user_name,
        "user_image": user_image
    })

# Endpoint para buscar as músicas do usuário no Spotify
@spotify_bp.route('/api/snake-tracks')
def get_snake_tracks():
    if 'spotify_token' not in session:
        return jsonify({"error": "Não autenticado"}), 401
    
    period = request.args.get('period', '12month')
    
    # Mapeamento de períodos para os valores aceitos pela API do Spotify
    period_map = {
        '1month': 'short_term',
        '6month': 'medium_term',
        '12month': 'long_term',
        'overall': 'long_term'  # Spotify não tem "overall", usamos long_term
    }
    
    spotify_period = period_map.get(period, 'long_term')
    
    # Cria uma sessão OAuth com o token armazenado
    spotify = OAuth2Session(SPOTIFY_CLIENT_ID, token=session['spotify_token'])
    
    try:
        # Busca as top tracks do usuário
        response = spotify.get(
            f"{SPOTIFY_API_BASE_URL}me/top/tracks",
            params={"limit": 50, "time_range": spotify_period}
        )
        
        if response.status_code != 200:
            return jsonify({"error": "Erro ao buscar músicas", "details": response.text}), response.status_code
        
        data = response.json()
        
        # Formata os dados para o formato esperado pelo jogo
        tracks = []
        for item in data.get('items', []):
            # Busca a URL de preview no Deezer se disponível
            deezer_preview = get_deezer_preview(f"{item['name']} {item['artists'][0]['name']}")
            
            track = {
                "id": item['id'],
                "name": item['name'],
                "artist": item['artists'][0]['name'],
                "image": item['album']['images'][0]['url'] if item['album']['images'] else "",
                "preview": deezer_preview or item.get('preview_url', "")
            }
            tracks.append(track)
        
        return jsonify(tracks)
    
    except Exception as e:
        return jsonify({"error": "Erro ao processar músicas", "details": str(e)}), 500

# Função para buscar preview de música no Deezer
def get_deezer_preview(query):
    try:
        # Busca a música no Deezer
        response = requests.get(
            "https://api.deezer.com/search",
            params={"q": query, "limit": 1}
        )
        
        if response.status_code != 200:
            return None
        
        data = response.json()
        
        # Retorna a URL de preview se disponível
        if data.get('data') and len(data['data']) > 0:
            return data['data'][0].get('preview', None)
        
        return None
    
    except Exception:
        return None
