import os
import logging
from flask import Flask
from flask_login import LoginManager
from flask_mail import Mail
from werkzeug.middleware.proxy_fix import ProxyFix
from models import db, User

logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Database configuration
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///elp_obras.db"
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Mail configuration
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')

# Upload configuration
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Initialize extensions
db.init_app(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Por favor, faça login para acessar esta página.'
mail = Mail(app)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Import routes after app initialization
from routes import *

with app.app_context():
    db.create_all()
    # Create default admin user if none exists
    admin_user = User.query.filter_by(email='admin@elp.com').first()
    if not admin_user:
        from werkzeug.security import generate_password_hash
        admin_user = User()
        admin_user.nome = 'Administrador'
        admin_user.email = 'admin@elp.com'
        admin_user.senha_hash = generate_password_hash('admin123')
        admin_user.role = 'admin'
        db.session.add(admin_user)
        db.session.commit()
        print("Admin user created: admin@elp.com / admin123")
    
    # Create default construction audit checklist if none exists
    from models import Checklist
    if not Checklist.query.filter_by(nome='Auditoria de Obra').first():
        checklist = Checklist()
        checklist.nome = 'Auditoria de Obra'
        checklist.campos = [
            'Equipamentos de Segurança (EPIs)',
            'Sinalização de Segurança',
            'Andaimes e Proteções',
            'Estado dos Equipamentos',
            'Organização do Canteiro',
            'Gestão de Resíduos',
            'Documentação Técnica',
            'Qualidade dos Materiais',
            'Cronograma de Execução',
            'Normas Técnicas (NBRs)',
            'Licenças e Alvarás',
            'Capacitação da Equipe'
        ]
        checklist.obrigatorios = [
            'Equipamentos de Segurança (EPIs)',
            'Sinalização de Segurança',
            'Andaimes e Proteções',
            'Documentação Técnica'
        ]
        checklist.ativo = True
        db.session.add(checklist)
        db.session.commit()
        print("Default construction audit checklist created")
    
    # Create a sample construction project if none exists
    from models import Obra
    if not Obra.query.first():
        sample_obra = Obra()
        sample_obra.nome = 'Edifício Comercial - Centro'
        sample_obra.tipo = 'Edifício Comercial'
        sample_obra.responsavel_id = admin_user.id
        sample_obra.endereco = 'Rua Principal, 123 - Centro'
        sample_obra.descricao = 'Construção de edifício comercial de 5 andares'
        sample_obra.status = 'ativa'
        db.session.add(sample_obra)
        db.session.commit()
        print("Sample construction project created")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
