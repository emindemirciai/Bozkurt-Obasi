FROM nginx:1.27-alpine
COPY infrastructure/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY Builds/WebGL/ /usr/share/nginx/html/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
