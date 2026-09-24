FROM nginxinc/nginx-unprivileged:stable-alpine
COPY services/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY services/admin/index.html services/admin/app.css services/admin/app.js /usr/share/nginx/html/
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/healthz || exit 1
