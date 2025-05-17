from flask import Blueprint, request, jsonify, session
import requests
import os
import json

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

# Função para processar e adicionar imagens às tracks
def process_tracks_with_images(tracks_list):
    if not tracks_list:
        return []
    
    processed_tracks = []
    
    for track in tracks_list:
        # Verifica se já tem uma imagem válida do Last.fm
        has_valid_image = False
        track_image = None
        
        if isinstance(track, dict) and 'image' in track:
            for img in track['image']:
                if img.get('#text') and not img.get('#text').endswith('2a96cbd8b46e442fc41c2b86b821562f.png'):
                    has_valid_image = True
                    track_image = img.get('#text')
                    break
        
        # Se não tiver imagem válida, busca no Deezer
        if not has_valid_image:
            artist_name = track.get('artist', {}).get('name', '') if isinstance(track.get('artist'), dict) else track.get('artist', {}).get('#text', '')
            track_name = track.get('name', '')
            
            if artist_name and track_name:
                deezer_image = get_deezer_image(artist_name, track_name)
                
                if deezer_image:
                    track_image = deezer_image
                    
                    # Adiciona a imagem do Deezer ao objeto da track
                    if 'image' not in track:
                        track['image'] = []
                    
                    # Adiciona a imagem em diferentes tamanhos (simulando o formato do Last.fm)
                    track['image'] = [
                        {'#text': deezer_image, 'size': 'small'},
                        {'#text': deezer_image, 'size': 'medium'},
                        {'#text': deezer_image, 'size': 'large'},
                        {'#text': deezer_image, 'size': 'extralarge'}
                    ]
        
        # Adiciona a track processada à lista
        processed_tracks.append({
            'name': track.get('name', ''),
            'artist': artist_name,
            'playcount': track.get('playcount', '0'),
            'image': track_image or 'https://via.placeholder.com/50?text=?',
            'url': track.get('url', '')
        })
    
    return processed_tracks

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
        
        top_tracks = []
        if top_tracks_response.status_code == 200:
            top_tracks_data = top_tracks_response.json()
            if 'toptracks' in top_tracks_data and 'track' in top_tracks_data['toptracks']:
                top_tracks = process_tracks_with_images(top_tracks_data['toptracks']['track'])
        
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
        
        top_artists = []
        if top_artists_response.status_code == 200:
            top_artists_data = top_artists_response.json()
            if 'topartists' in top_artists_data and 'artist' in top_artists_data['topartists']:
                for artist in top_artists_data['topartists']['artist']:
                    artist_image = None
                    if 'image' in artist:
                        for img in artist['image']:
                            if img.get('#text') and not img.get('#text').endswith('2a96cbd8b46e442fc41c2b86b821562f.png'):
                                artist_image = img.get('#text')
                                break
                    
                    top_artists.append({
                        'name': artist.get('name', ''),
                        'playcount': artist.get('playcount', '0'),
                        'image': artist_image or 'https://via.placeholder.com/50?text=?',
                        'url': artist.get('url', '')
                    })
        
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
        
        recent_tracks = []
        if recent_tracks_response.status_code == 200:
            recent_tracks_data = recent_tracks_response.json()
            if 'recenttracks' in recent_tracks_data and 'track' in recent_tracks_data['recenttracks']:
                recent_tracks = process_tracks_with_images(recent_tracks_data['recenttracks']['track'])
        
        # Retorna todos os dados coletados em formato simplificado
        return jsonify({
            "user": {
                "name": user_data.get('user', {}).get('name', ''),
                "url": user_data.get('user', {}).get('url', ''),
                "playcount": user_data.get('user', {}).get('playcount', '0'),
                "image": user_data.get('user', {}).get('image', [{}])[-1].get('#text', '')
            },
            "top_tracks": top_tracks,
            "top_artists": top_artists,
            "recent_tracks": recent_tracks
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
