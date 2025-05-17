from flask import Blueprint, request, jsonify, session
import requests
import os

lastfm_bp = Blueprint('lastfm', __name__)

# Configurações do Last.fm
LASTFM_API_KEY = os.getenv('LASTFM_API_KEY', '')
LASTFM_API_SECRET = os.getenv('LASTFM_API_SECRET', '')
LASTFM_API_BASE_URL = 'http://ws.audioscrobbler.com/2.0/'

@lastfm_bp.route('/api/lastfm/stats')
def get_lastfm_stats():
    if not LASTFM_API_KEY:
        return jsonify({"error": "API do Last.fm não configurada"}), 500
    
    username = request.args.get('username', '')
    
    if not username:
        return jsonify({"error": "Nome de usuário do Last.fm não fornecido"}), 400
    
    try:
        # Busca informações do usuário no Last.fm
        response = requests.get(
            LASTFM_API_BASE_URL,
            params={
                "method": "user.getinfo",
                "user": username,
                "api_key": LASTFM_API_KEY,
                "format": "json"
            }
        )
        
        if response.status_code != 200:
            return jsonify({"error": "Erro ao buscar informações do Last.fm", "details": response.text}), response.status_code
        
        user_data = response.json()
        
        # Busca as top tracks do usuário
        top_tracks_response = requests.get(
            LASTFM_API_BASE_URL,
            params={
                "method": "user.gettoptracks",
                "user": username,
                "api_key": LASTFM_API_KEY,
                "format": "json",
                "limit": 10
            }
        )
        
        if top_tracks_response.status_code != 200:
            return jsonify({
                "user": user_data.get('user', {}),
                "error_top_tracks": "Não foi possível buscar top tracks",
                "details": top_tracks_response.text
            })
        
        top_tracks = top_tracks_response.json()
        
        # Busca os artistas mais ouvidos
        top_artists_response = requests.get(
            LASTFM_API_BASE_URL,
            params={
                "method": "user.gettopartists",
                "user": username,
                "api_key": LASTFM_API_KEY,
                "format": "json",
                "limit": 5
            }
        )
        
        top_artists = {}
        if top_artists_response.status_code == 200:
            top_artists = top_artists_response.json()
        
        # Busca estatísticas recentes
        recent_tracks_response = requests.get(
            LASTFM_API_BASE_URL,
            params={
                "method": "user.getrecenttracks",
                "user": username,
                "api_key": LASTFM_API_KEY,
                "format": "json",
                "limit": 5
            }
        )
        
        recent_tracks = {}
        if recent_tracks_response.status_code == 200:
            recent_tracks = recent_tracks_response.json()
        
        # Retorna todos os dados coletados
        return jsonify({
            "user": user_data.get('user', {}),
            "top_tracks": top_tracks.get('toptracks', {}),
            "top_artists": top_artists.get('topartists', {}),
            "recent_tracks": recent_tracks.get('recenttracks', {})
        })
    
    except Exception as e:
        return jsonify({"error": "Erro ao processar estatísticas do Last.fm", "details": str(e)}), 500

# Rota para salvar o nome de usuário do Last.fm na sessão
@lastfm_bp.route('/api/lastfm/save-username', methods=['POST'])
def save_lastfm_username():
    data = request.json
    username = data.get('username', '')
    
    if not username:
        return jsonify({"error": "Nome de usuário não fornecido"}), 400
    
    # Salva o nome de usuário na sessão
    session['lastfm_username'] = username
    
    return jsonify({"success": True, "username": username})

# Rota para obter o nome de usuário do Last.fm da sessão
@lastfm_bp.route('/api/lastfm/get-username')
def get_lastfm_username():
    username = session.get('lastfm_username', '')
    
    return jsonify({
        "username": username,
        "has_username": bool(username)
    })
