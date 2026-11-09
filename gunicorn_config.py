import multiprocessing

bind = "0.0.0.0:5000"
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
worker_connections = 1000
timeout = 120
keepalive = 5
errorlog = "logs/gunicorn_error.log"
accesslog = "logs/gunicorn_access.log"
loglevel = "info"
