from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
import json

db = SQLAlchemy()

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    senha_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), default='user')  # 'admin' or 'user'
    data_criacao = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    obras_responsavel = db.relationship('Obra', backref='responsavel', lazy=True, foreign_keys='Obra.responsavel_id')
    relatorios = db.relationship('Relatorio', backref='usuario', lazy=True, foreign_keys='Relatorio.usuario_id')

class Obra(db.Model):
    __tablename__ = 'obras'
    
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(200), nullable=False)
    tipo = db.Column(db.String(100), nullable=False)
    responsavel_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    status = db.Column(db.String(50), default='ativa')
    data_inicio = db.Column(db.Date)
    data_fim = db.Column(db.Date)
    endereco = db.Column(db.Text)
    endereco_gps = db.Column(db.String(300))
    latitude_obra = db.Column(db.Float)
    longitude_obra = db.Column(db.Float)
    descricao = db.Column(db.Text)
    data_criacao = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    relatorios = db.relationship('Relatorio', backref='obra', lazy=True, cascade='all, delete-orphan')
    contatos = db.relationship('Contato', backref='obra', lazy=True, cascade='all, delete-orphan')
    alertas = db.relationship('Alerta', backref='obra', lazy=True, cascade='all, delete-orphan')

class Relatorio(db.Model):
    __tablename__ = 'relatorios'
    
    id = db.Column(db.Integer, primary_key=True)
    obra_id = db.Column(db.Integer, db.ForeignKey('obras.id'), nullable=False)
    usuario_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    numero_seq = db.Column(db.Integer, nullable=False)
    codigo_relatorio = db.Column(db.String(20), nullable=False)  # ELP-2025-001-v1
    versao = db.Column(db.Integer, default=1)
    data = db.Column(db.Date, default=datetime.utcnow)
    atividades = db.Column(db.Text)
    checklist_json = db.Column(db.Text)
    aprovador_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    status = db.Column(db.String(20), default='pendente')  # 'pendente', 'aprovado', 'reprovado'
    observacoes_admin = db.Column(db.Text)
    prazo_revisao = db.Column(db.DateTime)
    data_aprovacao = db.Column(db.DateTime)
    pdf_path = db.Column(db.String(200))
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    data_criacao = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    fotos = db.relationship('Foto', backref='relatorio', lazy=True, cascade='all, delete-orphan')
    aprovador = db.relationship('User', foreign_keys=[aprovador_id], backref='relatorios_aprovados')
    
    @property
    def checklist_data(self):
        if self.checklist_json:
            return json.loads(self.checklist_json)
        return {}
    
    @checklist_data.setter
    def checklist_data(self, data):
        self.checklist_json = json.dumps(data) if data else None

class Checklist(db.Model):
    __tablename__ = 'checklists'
    
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    campos_json = db.Column(db.Text, nullable=False)
    obrigatorios_json = db.Column(db.Text)
    ativo = db.Column(db.Boolean, default=True)
    data_criacao = db.Column(db.DateTime, default=datetime.utcnow)
    
    @property
    def campos(self):
        return json.loads(self.campos_json) if self.campos_json else []
    
    @campos.setter
    def campos(self, data):
        self.campos_json = json.dumps(data) if data else '[]'
    
    @property
    def obrigatorios(self):
        return json.loads(self.obrigatorios_json) if self.obrigatorios_json else []
    
    @obrigatorios.setter
    def obrigatorios(self, data):
        self.obrigatorios_json = json.dumps(data) if data else '[]'

class Contato(db.Model):
    __tablename__ = 'contatos'
    
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120))
    telefone = db.Column(db.String(20))
    obra_id = db.Column(db.Integer, db.ForeignKey('obras.id'), nullable=False)
    cargo = db.Column(db.String(100))
    data_criacao = db.Column(db.DateTime, default=datetime.utcnow)

class Foto(db.Model):
    __tablename__ = 'fotos'
    
    id = db.Column(db.Integer, primary_key=True)
    relatorio_id = db.Column(db.Integer, db.ForeignKey('relatorios.id'), nullable=False)
    tipo_servico = db.Column(db.String(100), nullable=False)
    caminho_arquivo = db.Column(db.String(200), nullable=False)
    tamanho = db.Column(db.Integer)
    descricao = db.Column(db.Text)
    data_upload = db.Column(db.DateTime, default=datetime.utcnow)

class Alerta(db.Model):
    __tablename__ = 'alertas'
    
    id = db.Column(db.Integer, primary_key=True)
    obra_id = db.Column(db.Integer, db.ForeignKey('obras.id'), nullable=False)
    descricao = db.Column(db.Text, nullable=False)
    data_alerta = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(20), default='pendente')  # 'pendente', 'resolvido'
    data_criacao = db.Column(db.DateTime, default=datetime.utcnow)

class HistoricoAprovacao(db.Model):
    __tablename__ = 'historico_aprovacoes'
    
    id = db.Column(db.Integer, primary_key=True)
    relatorio_id = db.Column(db.Integer, db.ForeignKey('relatorios.id'), nullable=False)
    aprovador_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    acao = db.Column(db.String(20), nullable=False)  # 'aprovado', 'reprovado'
    observacoes = db.Column(db.Text)
    data_acao = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    aprovador = db.relationship('User', backref='historico_aprovacoes')


