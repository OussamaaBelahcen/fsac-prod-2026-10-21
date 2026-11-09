import logging
import os
from datetime import datetime

class LoggerService:
    _logger = None

    @classmethod
    def _setup_logger(cls):
        if cls._logger:
            return

        # Création du dossier logs s'il n'existe pas
        log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs')
        if not os.path.exists(log_dir):
            os.makedirs(log_dir)

        # Configuration du logger
        cls._logger = logging.getLogger('fsac_logger')
        cls._logger.setLevel(logging.INFO)
        
        # Eviter d'ajouter plusieurs handlers si le logger est déjà configuré
        if not cls._logger.handlers:
            # Handler fichier
            file_handler = logging.FileHandler(os.path.join(log_dir, 'activity.log'), encoding='utf-8')
            file_handler.setLevel(logging.INFO)
            
            # Handler console
            console_handler = logging.StreamHandler()
            console_handler.setLevel(logging.INFO)
            
            # Format
            formatter = logging.Formatter('%(asctime)s | %(levelname)s | %(message)s', datefmt='%Y-%m-%d %H:%M:%S')
            file_handler.setFormatter(formatter)
            console_handler.setFormatter(formatter)
            
            cls._logger.addHandler(file_handler)
            cls._logger.addHandler(console_handler)

    @classmethod
    def log_action(cls, user_email, role, action, details=None, status="SUCCESS"):
        """
        Enregistre une action critique.
        :param user_email: Email de l'utilisateur qui fait l'action
        :param role: Rôle de l'utilisateur
        :param action: L'action effectuée (ex: "LOGIN", "VALIDATION_DOSSIER")
        :param details: Détails supplémentaires (ex: "Dossier ID: 12", "IP: 127.0.0.1")
        :param status: "SUCCESS", "FAILURE", "WARNING"
        """
        cls._setup_logger()
        
        details_str = f" | Details: {details}" if details else ""
        message = f"User: {user_email} ({role}) | Action: {action} | Status: {status}{details_str}"
        
        if status == "FAILURE":
            cls._logger.error(message)
        elif status == "WARNING":
            cls._logger.warning(message)
        else:
            cls._logger.info(message)

    @classmethod
    def log_error(cls, source, error_message, user_email="system"):
        """
        Enregistre une erreur technique.
        """
        cls._setup_logger()
        cls._logger.error(f"Source: {source} | User: {user_email} | Error: {error_message}")
