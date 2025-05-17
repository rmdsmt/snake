from flask import Blueprint, request, jsonify, session
import requests
import os

lastfm_bp = Blueprint('lastfm', __name__)

# Configurações do Last.fm
LASTFM_API_KEY = os.getenv('LASTFM_API_KEY', '')
LASTFM_API_SECRET = os.getenv('LASTFM_API_SECRET', '')
LASTFM_API_BASE_URL = 'http://ws.audioscrobbler.com/2.0/'

# Função para buscar imagem de capa via Deezer
def get_deezer_image(artist, track):
    try:
        # Busca a música no Deezer
        query = f"{artist} {track}"
        response = requests.get(
            "https://api.deezer.com/search",
            params={"q": query, "limit": 1}
        )
        
        if response.status_code != 200:
            return None
        
        data = response.json()
        
        # Retorna a URL da imagem se disponível
        if data.get('data') and len(data['data']) > 0:
            album = data['data'][0].get('album', {})
            if album and 'cover_medium' in album:
                return album['cover_medium']
        
        return None
    except Exception as e:
        print(f"Erro ao buscar imagem no Deezer: {e}")
        return None

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
        
        top_tracks_data = top_tracks_response.json()
        
        # Enriquece as top tracks com imagens do Deezer
        if 'toptracks' in top_tracks_data and 'track' in top_tracks_data['toptracks']:
            for track in top_tracks_data['toptracks']['track']:
                # Verifica se já tem uma imagem válida do Last.fm
                has_valid_image = False
                if 'image' in track:
                    for img in track['image']:
                        if img.get('#text') and not img.get('#text').endswith('2a96cbd8b46e442fc41c2b86b821562f.png'):
                            has_valid_image = True
                            break
                
                # Se não tiver imagem válida, busca no Deezer
                if not has_valid_image:
                    artist_name = track['artist']['name']
                    track_name = track['name']
                    deezer_image = get_deezer_image(artist_name, track_name)
                    
                    if deezer_image:
                        # Adiciona a imagem do Deezer ao objeto da track
                        if 'image' not in track:
                            track['image'] = []
                        
                        # Adiciona a imagem em diferentes tamanhos (simulando o formato do Last.fm)
                        track['image'].append({'#text': deezer_image, 'size': 'small'})
                        track['image'].append({'#text': deezer_image, 'size': 'medium'})
                        track['image'].append({'#text': deezer_image, 'size': 'large'})
                        track['image'].append({'#text': deezer_image, 'size': 'extralarge'})
        
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
            recent_tracks_data = recent_tracks_response.json()
            
            # Enriquece as recent tracks com imagens do Deezer
            if 'recenttracks' in recent_tracks_data and 'track' in recent_tracks_data['recenttracks']:
                for track in recent_tracks_data['recenttracks']['track']:
                    # Verifica se já tem uma imagem válida do Last.fm
                    has_valid_image = False
                    if 'image' in track:
                        for img in track['image']:
                            if img.get('#text') and not img.get('#text').endswith('2a96cbd8b46e442fc41c2b86b821562f.png'):
                                has_valid_image = True
                                break
                    
                    # Se não tiver imagem válida, busca no Deezer
                    if not has_valid_image:
                        artist_name = track['artist']['#text']
                        track_name = track['name']
                        deezer_image = get_deezer_image(artist_name, track_name)
                        
                        if deezer_image:
                            # Adiciona a imagem do Deezer ao objeto da track
                            if 'image' not in track:
                                track['image'] = []
                            
                            # Adiciona a imagem em diferentes tamanhos (simulando o formato do Last.fm)
                            track['image'].append({'#text': deezer_image, 'size': 'small'})
                            track['image'].append({'#text': deezer_image, 'size': 'medium'})
                            track['image'].append({'#text': deezer_image, 'size': 'large'})
                            track['image'].append({'#text': deezer_image, 'size': 'extralarge'})
            
            recent_tracks = recent_tracks_data
        
        # Retorna todos os dados coletados
        return jsonify({
            "user": user_data.get('user', {}),
            "top_tracks": top_tracks_data.get('toptracks', {}),
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
