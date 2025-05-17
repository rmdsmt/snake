import sys
import os
import secrets
from flask import Flask, redirect, request, session, url_for, jsonify, render_template
from flask_session import Session

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))  # DON'T CHANGE THIS !!!

# Importa os blueprints
from src.routes.spotify import spotify_bp
from src.routes.lastfm import lastfm_bp

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(16)
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_FILE_DIR'] = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'flask_session')
app.config['SESSION_PERMANENT'] = False
Session(app)

# Registra os blueprints
app.register_blueprint(spotify_bp)
app.register_blueprint(lastfm_bp)

# Rotas para servir arquivos estáticos
@app.route('/')
def index():
    return render_template('index.html')

# Rota para logout
@app.route('/logout')
def logout():
    session.clear()
    return redirect('/')

if __name__ == '__main__':
    # Cria o diretório de sessão se não existir
    os.makedirs(app.config['SESSION_FILE_DIR'], exist_ok=True)
    
    # Verifica se as variáveis de ambiente estão configuradas
    spotify_client_id = os.getenv('SPOTIFY_CLIENT_ID')
    spotify_client_secret = os.getenv('SPOTIFY_CLIENT_SECRET')
    lastfm_api_key = os.getenv('LASTFM_API_KEY')
    
    if not spotify_client_id or not spotify_client_secret:
        print("AVISO: Credenciais do Spotify não configuradas. Configure as variáveis de ambiente SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET.")
    
    if not lastfm_api_key:
        print("AVISO: API Key do Last.fm não configurada. Configure a variável de ambiente LASTFM_API_KEY.")
    
    app.run(host='0.0.0.0', port=5000, debug=True)
