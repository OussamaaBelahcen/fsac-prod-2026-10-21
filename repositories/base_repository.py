from app import mysql

class BaseRepository:
    @staticmethod
    def get_cursor():
        return mysql.connection.cursor()

    @staticmethod
    def commit():
        mysql.connection.commit()

    @staticmethod
    def rollback():
        mysql.connection.rollback()
