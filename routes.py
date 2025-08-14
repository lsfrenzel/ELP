import os
from flask import render_template, request, redirect, url_for, flash, jsonify, send_file
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename
from PIL import Image
import json
from datetime import datetime, date, timedelta
from functools import wraps

from app import app, db, mail
from models import User, Obra, Relatorio, Checklist, Contato, Foto, Alerta, Reembolso
from utils import send_email, generate_pdf_report, allowed_file

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role != 'admin':
            flash('Acesso negado. Apenas administradores podem acessar esta página.', 'error')
            return redirect(url_for('dashboard'))
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        user = User.query.filter_by(email=email).first()
        
        if user and user.senha_hash and check_password_hash(user.senha_hash, password):
            login_user(user)
            flash('Login realizado com sucesso!', 'success')
            
            # Redirect based on user role
            if user.role == 'admin':
                return redirect(url_for('admin_panel'))
            else:
                return redirect(url_for('dashboard'))
        else:
            flash('Email ou senha incorretos.', 'error')
    
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Logout realizado com sucesso!', 'success')
    return redirect(url_for('login'))

@app.route('/register', methods=['GET', 'POST'])
@login_required
@admin_required
def register():
    if request.method == 'POST':
        nome = request.form.get('nome')
        email = request.form.get('email')
        password = request.form.get('password')
        role = request.form.get('role', 'user')
        
        # Check if user already exists
        if User.query.filter_by(email=email).first():
            flash('Um usuário com este email já existe.', 'error')
            return render_template('register.html')
        
        # Create new user
        user = User()
        user.nome = nome
        user.email = email
        user.senha_hash = generate_password_hash(password)
        user.role = role
        
        db.session.add(user)
        try:
            db.session.commit()
            flash(f'Usuário {nome} criado com sucesso!', 'success')
            return redirect(url_for('admin_panel'))
        except Exception as e:
            db.session.rollback()
            flash('Erro ao criar usuário. Tente novamente.', 'error')
    
    return render_template('register.html')

@app.route('/dashboard')
@login_required
def dashboard():
    # Get user's projects and recent reports
    if current_user.role == 'admin':
        obras = Obra.query.all()
        relatorios_recentes = Relatorio.query.order_by(Relatorio.data_criacao.desc()).limit(5).all()
    else:
        obras = Obra.query.filter_by(responsavel_id=current_user.id).all()
        relatorios_recentes = Relatorio.query.filter_by(usuario_id=current_user.id).order_by(Relatorio.data_criacao.desc()).limit(5).all()
    
    # Get alerts for current user
    if current_user.role == 'admin':
        alertas = Alerta.query.filter(Alerta.data_alerta >= datetime.now()).order_by(Alerta.data_alerta.asc()).limit(5).all()
        # Also get pending reports for approval
        relatorios_pendentes = Relatorio.query.filter_by(status='pendente').count()
        relatorios_reprovados = Relatorio.query.filter_by(status='reprovado', usuario_id=current_user.id).filter(
            Relatorio.prazo_revisao >= datetime.now()).count() if current_user.role != 'admin' else 0
    else:
        # Get alerts for user's projects and overdue reports
        user_obra_ids = [obra.id for obra in obras]
        alertas = Alerta.query.filter(Alerta.obra_id.in_(user_obra_ids), Alerta.data_alerta >= datetime.now()).order_by(Alerta.data_alerta.asc()).limit(5).all()
        relatorios_pendentes = 0
        relatorios_reprovados = Relatorio.query.filter_by(status='reprovado', usuario_id=current_user.id).filter(
            Relatorio.prazo_revisao >= datetime.now()).count()
    
    return render_template('dashboard.html', 
                         obras=obras, 
                         relatorios_recentes=relatorios_recentes,
                         alertas=alertas,
                         relatorios_pendentes=relatorios_pendentes if current_user.role == 'admin' else 0,
                         relatorios_reprovados=relatorios_reprovados)

@app.route('/admin')
@login_required
@admin_required
def admin_panel():
    users_count = User.query.count()
    obras_count = Obra.query.count()
    relatorios_count = Relatorio.query.count()
    checklists_count = Checklist.query.count()
    relatorios_pendentes = Relatorio.query.filter_by(status='pendente').count()
    
    return render_template('admin_panel.html',
                         users_count=users_count,
                         obras_count=obras_count,
                         relatorios_count=relatorios_count,
                         checklists_count=checklists_count,
                         relatorios_pendentes=relatorios_pendentes)

@app.route('/projects')
@login_required
def projects():
    if current_user.role == 'admin':
        obras = Obra.query.all()
    else:
        obras = Obra.query.filter_by(responsavel_id=current_user.id).all()
    
    users = User.query.all() if current_user.role == 'admin' else []
    
    return render_template('projects.html', obras=obras, users=users)

@app.route('/projects/create', methods=['POST'])
@login_required
def create_project():
    if current_user.role != 'admin':
        flash('Apenas administradores podem criar obras.', 'error')
        return redirect(url_for('projects'))
    
    nome = request.form.get('nome')
    tipo = request.form.get('tipo')
    responsavel_id = request.form.get('responsavel_id')
    endereco = request.form.get('endereco')
    endereco_gps = request.form.get('endereco_gps')
    latitude_obra = request.form.get('latitude_obra')
    longitude_obra = request.form.get('longitude_obra')
    descricao = request.form.get('descricao')
    
    obra = Obra()
    obra.nome = nome
    obra.tipo = tipo
    obra.responsavel_id = responsavel_id
    obra.endereco = endereco
    obra.endereco_gps = endereco_gps
    obra.latitude_obra = float(latitude_obra) if latitude_obra else None
    obra.longitude_obra = float(longitude_obra) if longitude_obra else None
    obra.descricao = descricao
    
    db.session.add(obra)
    db.session.commit()
    
    flash('Obra criada com sucesso!', 'success')
    return redirect(url_for('projects'))

@app.route('/reports')
@login_required
def reports():
    obra_id = request.args.get('obra_id')
    
    if current_user.role == 'admin':
        if obra_id:
            relatorios = Relatorio.query.filter_by(obra_id=obra_id).order_by(Relatorio.data_criacao.desc()).all()
            obras = Obra.query.all()
        else:
            relatorios = Relatorio.query.order_by(Relatorio.data_criacao.desc()).all()
            obras = Obra.query.all()
    else:
        if obra_id:
            # Verify user has access to this project
            obra = Obra.query.filter_by(id=obra_id, responsavel_id=current_user.id).first()
            if not obra:
                flash('Acesso negado a esta obra.', 'error')
                return redirect(url_for('reports'))
            relatorios = Relatorio.query.filter_by(obra_id=obra_id).order_by(Relatorio.data_criacao.desc()).all()
        else:
            relatorios = Relatorio.query.filter_by(usuario_id=current_user.id).order_by(Relatorio.data_criacao.desc()).all()
        obras = Obra.query.filter_by(responsavel_id=current_user.id).all()
    
    return render_template('reports.html', relatorios=relatorios, obras=obras, selected_obra=obra_id)

@app.route('/reports/create')
@login_required
def create_report_form():
    if current_user.role == 'admin':
        obras = Obra.query.all()
    else:
        obras = Obra.query.filter_by(responsavel_id=current_user.id).all()
    
    checklists = Checklist.query.filter_by(ativo=True).all()
    today_date = datetime.now().strftime('%Y-%m-%d')
    
    return render_template('create_report.html', obras=obras, checklists=checklists, today_date=today_date)

@app.route('/reports/create', methods=['POST'])
@login_required
def create_report():
    obra_id = request.form.get('obra_id')
    atividades = request.form.get('atividades')
    checklist_data = {}
    latitude = request.form.get('latitude')
    longitude = request.form.get('longitude')
    
    # Verify user has access to this project
    if current_user.role != 'admin':
        obra = Obra.query.filter_by(id=obra_id, responsavel_id=current_user.id).first()
        if not obra:
            flash('Acesso negado a esta obra.', 'error')
            return redirect(url_for('reports'))
    else:
        obra = Obra.query.get(obra_id)
    
    # Process checklist data
    for key in request.form:
        if key.startswith('checklist_'):
            field_name = key.replace('checklist_', '')
            checklist_data[field_name] = request.form[key]
    
    # Generate sequential number for this project
    last_report = Relatorio.query.filter_by(obra_id=obra_id).order_by(Relatorio.numero_seq.desc()).first()
    numero_seq = (last_report.numero_seq + 1) if last_report else 1
    
    relatorio = Relatorio()
    relatorio.obra_id = obra_id
    relatorio.usuario_id = current_user.id
    relatorio.numero_seq = numero_seq
    relatorio.atividades = atividades
    relatorio.checklist_data = checklist_data
    relatorio.latitude = float(latitude) if latitude else None
    relatorio.longitude = float(longitude) if longitude else None
    
    db.session.add(relatorio)
    db.session.commit()
    
    flash('Relatório criado com sucesso e enviado para aprovação!', 'success')
    return redirect(url_for('reports'))

@app.route('/contacts')
@login_required
def contacts():
    if current_user.role == 'admin':
        contatos = Contato.query.all()
        obras = Obra.query.all()
    else:
        # Only show contacts for user's projects
        user_obras = Obra.query.filter_by(responsavel_id=current_user.id).all()
        obra_ids = [obra.id for obra in user_obras]
        contatos = Contato.query.filter(Contato.obra_id.in_(obra_ids)).all()
        obras = user_obras
    
    return render_template('contacts.html', contatos=contatos, obras=obras)

@app.route('/contacts/create', methods=['POST'])
@login_required
def create_contact():
    nome = request.form.get('nome')
    email = request.form.get('email')
    telefone = request.form.get('telefone')
    obra_id = request.form.get('obra_id')
    cargo = request.form.get('cargo')
    
    # Verify user has access to this project
    if current_user.role != 'admin':
        obra = Obra.query.filter_by(id=obra_id, responsavel_id=current_user.id).first()
        if not obra:
            flash('Acesso negado a esta obra.', 'error')
            return redirect(url_for('contacts'))
    
    contato = Contato()
    contato.nome = nome
    contato.email = email
    contato.telefone = telefone
    contato.obra_id = obra_id
    contato.cargo = cargo
    
    db.session.add(contato)
    db.session.commit()
    
    flash('Contato criado com sucesso!', 'success')
    return redirect(url_for('contacts'))

@app.route('/upload_photo/<int:relatorio_id>', methods=['POST'])
@login_required
def upload_photo(relatorio_id):
    relatorio = Relatorio.query.get_or_404(relatorio_id)
    
    # Verify user has access to this report
    if current_user.role != 'admin' and relatorio.usuario_id != current_user.id:
        return jsonify({'error': 'Acesso negado'}), 403
    
    if 'file' not in request.files:
        return jsonify({'error': 'Nenhum arquivo enviado'}), 400
    
    file = request.files['file']
    tipo_servico = request.form.get('tipo_servico', 'Geral')
    descricao = request.form.get('descricao', '')
    
    if file.filename == '':
        return jsonify({'error': 'Nenhum arquivo selecionado'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        # Add timestamp to avoid conflicts
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_')
        filename = timestamp + filename
        
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        # Create upload directory if it doesn't exist
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        
        file.save(filepath)
        
        # Resize image if it's too large
        try:
            with Image.open(filepath) as img:
                if img.width > 1920 or img.height > 1080:
                    img.thumbnail((1920, 1080), Image.Resampling.LANCZOS)
                    img.save(filepath)
                
                file_size = os.path.getsize(filepath)
        except Exception as e:
            file_size = os.path.getsize(filepath)
        
        foto = Foto()
        foto.relatorio_id = relatorio_id
        foto.tipo_servico = tipo_servico
        foto.caminho_arquivo = filename
        foto.tamanho = file_size
        foto.descricao = descricao
        
        db.session.add(foto)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'filename': filename,
            'tipo_servico': tipo_servico
        })
    
    return jsonify({'error': 'Tipo de arquivo não permitido'}), 400

@app.route('/api/checklists/<int:checklist_id>')
@login_required
def get_checklist(checklist_id):
    checklist = Checklist.query.get_or_404(checklist_id)
    return jsonify({
        'id': checklist.id,
        'nome': checklist.nome,
        'campos': checklist.campos,
        'obrigatorios': checklist.obrigatorios
    })

@app.route('/manifest.json')
def manifest():
    return app.send_static_file('manifest.json')

@app.route('/sw.js')
def service_worker():
    return app.send_static_file('sw.js')

@app.route('/reports/pdf/<int:report_id>')
@login_required
def generate_report_pdf(report_id):
    relatorio = Relatorio.query.get_or_404(report_id)
    
    # Check permissions
    if current_user.role != 'admin' and relatorio.usuario_id != current_user.id:
        flash('Acesso negado.', 'error')
        return redirect(url_for('reports'))
    
    try:
        pdf_filename = generate_pdf_report(relatorio)
        
        if pdf_filename:
            pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], pdf_filename)
            if os.path.exists(pdf_path):
                # Update the report with the PDF path
                relatorio.pdf_path = pdf_filename
                db.session.commit()
                
                safe_obra_name = "".join(c for c in relatorio.obra.nome if c.isalnum() or c in (' ', '-', '_')).rstrip()
                return send_file(pdf_path, as_attachment=True, 
                               download_name=f'relatorio_{relatorio.numero_seq:03d}_{safe_obra_name}.pdf')
        
        flash('Erro ao gerar PDF do relatório.', 'error')
        return redirect(url_for('reports'))
    except Exception as e:
        flash(f'Erro ao gerar PDF: {str(e)}', 'error')
        return redirect(url_for('reports'))

# Admin workflow and checklist management routes
@app.route('/admin/checklists')
@login_required
@admin_required
def admin_checklists():
    checklists = Checklist.query.all()
    return render_template('admin_checklists.html', checklists=checklists)

@app.route('/admin/checklists/create', methods=['GET', 'POST'])
@login_required
@admin_required
def create_checklist():
    if request.method == 'POST':
        nome = request.form.get('nome')
        campos = request.form.getlist('campos')
        obrigatorios = request.form.getlist('obrigatorios')
        
        checklist = Checklist()
        checklist.nome = nome
        checklist.campos = [campo for campo in campos if campo.strip()]
        checklist.obrigatorios = [obr for obr in obrigatorios if obr.strip()]
        checklist.ativo = True
        
        db.session.add(checklist)
        db.session.commit()
        
        flash(f'Checklist "{nome}" criado com sucesso!', 'success')
        return redirect(url_for('admin_checklists'))
    
    return render_template('create_checklist.html')

@app.route('/admin/reports')
@login_required
@admin_required
def admin_reports():
    status_filter = request.args.get('status', 'pendente')
    
    if status_filter == 'all':
        relatorios = Relatorio.query.order_by(Relatorio.data_criacao.desc()).all()
    else:
        relatorios = Relatorio.query.filter_by(status=status_filter).order_by(Relatorio.data_criacao.desc()).all()
    
    return render_template('admin_reports.html', relatorios=relatorios, status_filter=status_filter)

@app.route('/admin/reports/<int:relatorio_id>/approve', methods=['POST'])
@login_required
@admin_required
def approve_report(relatorio_id):
    relatorio = Relatorio.query.get_or_404(relatorio_id)
    
    relatorio.status = 'aprovado'
    relatorio.aprovador_id = current_user.id
    relatorio.data_aprovacao = datetime.now()
    relatorio.observacoes_admin = request.form.get('observacoes', '')
    
    db.session.commit()
    
    flash('Relatório aprovado com sucesso!', 'success')
    return redirect(url_for('admin_reports'))

@app.route('/admin/reports/<int:relatorio_id>/reject', methods=['POST'])
@login_required
@admin_required
def reject_report(relatorio_id):
    relatorio = Relatorio.query.get_or_404(relatorio_id)
    
    observacoes = request.form.get('observacoes', '')
    prazo_dias = int(request.form.get('prazo_dias', 7))
    
    relatorio.status = 'reprovado'
    relatorio.aprovador_id = current_user.id
    relatorio.observacoes_admin = observacoes
    relatorio.prazo_revisao = datetime.now() + timedelta(days=prazo_dias)
    
    db.session.commit()
    
    # Create alert for the user
    alerta = Alerta()
    alerta.obra_id = relatorio.obra_id
    alerta.descricao = f'Relatório #{relatorio.numero_seq:03d} foi reprovado e precisa ser revisado até {relatorio.prazo_revisao.strftime("%d/%m/%Y")}'
    alerta.data_alerta = relatorio.prazo_revisao
    alerta.status = 'pendente'
    
    db.session.add(alerta)
    db.session.commit()
    
    flash(f'Relatório reprovado. Usuário tem até {relatorio.prazo_revisao.strftime("%d/%m/%Y")} para revisar.', 'warning')
    return redirect(url_for('admin_reports'))

@app.route('/api/checklists/<int:checklist_id>')
@login_required
def get_checklist_api(checklist_id):
    checklist = Checklist.query.get_or_404(checklist_id)
    return jsonify({
        'id': checklist.id,
        'nome': checklist.nome,
        'campos': checklist.campos,
        'obrigatorios': checklist.obrigatorios
    })
