# Guia de Implantação do MNZ Snake no Render

Este guia explica como implantar o jogo MNZ Snake (com integração Spotify, Deezer e Last.fm) no Render.

## Pré-requisitos

1. Uma conta no [Render](https://render.com/) (você pode se cadastrar gratuitamente)
2. Uma conta de desenvolvedor no [Spotify](https://developer.spotify.com/dashboard/)
3. Uma chave de API do [Last.fm](https://www.last.fm/api/account/create) (opcional)
4. Uma conta no [GitHub](https://github.com/) (para hospedar o código)

## Passo 1: Preparar o Repositório no GitHub

1. Crie um novo repositório no GitHub
2. Faça upload dos arquivos do projeto para o repositório:
   - Você pode fazer isso pelo site do GitHub ou usando Git

## Passo 2: Criar um Aplicativo no Spotify

1. Acesse o [Dashboard do Spotify para Desenvolvedores](https://developer.spotify.com/dashboard/)
2. Clique em "Create an App"
3. Preencha as informações do seu aplicativo:
   - Nome: MNZ Snake (ou outro nome de sua escolha)
   - Descrição: Jogo Snake com integração Spotify
4. Após criar o aplicativo, anote o **Client ID** e o **Client Secret**
5. Clique em "Edit Settings" e adicione a URL de redirecionamento:
   - `https://seu-app-render.onrender.com/callback/spotify`
   - Substitua "seu-app-render" pelo nome que você escolherá para seu aplicativo no Render

## Passo 3: Criar um Web Service no Render

1. Acesse o [Dashboard do Render](https://dashboard.render.com/)
2. Clique em "New" e selecione "Web Service"
3. Conecte seu repositório GitHub
4. Configure o serviço:
   - **Nome**: escolha um nome para seu aplicativo (ex: mnz-snake)
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn src.main:app`
   - **Plano**: Free (gratuito)

5. Configure as variáveis de ambiente (clique em "Advanced" e depois "Add Environment Variable"):
   - `SPOTIFY_CLIENT_ID`: seu Client ID do Spotify
   - `SPOTIFY_CLIENT_SECRET`: seu Client Secret do Spotify
   - `SPOTIFY_REDIRECT_URI`: `https://seu-app-render.onrender.com/callback/spotify`
   - `LASTFM_API_KEY`: sua API Key do Last.fm (opcional)
   - `SECRET_KEY`: uma string aleatória para segurança (ex: gere uma com `openssl rand -hex 16`)

6. Clique em "Create Web Service"

## Passo 4: Aguardar a Implantação

1. O Render começará a implantar seu aplicativo automaticamente
2. Este processo pode levar alguns minutos
3. Você pode acompanhar o progresso na aba "Logs"

## Passo 5: Acessar o Aplicativo

1. Após a implantação ser concluída, o Render fornecerá uma URL para seu aplicativo
2. Acesse a URL para verificar se o aplicativo está funcionando corretamente
3. Faça login com sua conta do Spotify e comece a jogar!

## Solução de Problemas

- **Erro de autenticação do Spotify**: Verifique se as variáveis de ambiente estão configuradas corretamente e se a URL de redirecionamento no Dashboard do Spotify corresponde exatamente à URL do seu aplicativo no Render.

- **Aplicativo não carrega**: Verifique os logs no Render para identificar possíveis erros.

- **Erro "Application Error"**: O aplicativo pode estar em modo de suspensão (nos planos gratuitos do Render). Basta recarregar a página.

## Atualização do Aplicativo

Para atualizar seu aplicativo:

1. Faça as alterações no código em seu repositório GitHub
2. Faça commit e push das alterações
3. O Render detectará automaticamente as mudanças e reimplantará seu aplicativo

## Personalização do Domínio (Opcional)

Se você possui um domínio personalizado:

1. No dashboard do Render, vá para seu serviço web
2. Clique na aba "Settings"
3. Role até "Custom Domain"
4. Siga as instruções para configurar seu domínio personalizado

## Observações Importantes

- O plano gratuito do Render tem algumas limitações:
  - O aplicativo "dorme" após períodos de inatividade
  - Há limites de uso mensal
  - Desempenho limitado

- Para uso mais intensivo, considere atualizar para um plano pago do Render
