import os
from flask import current_app
from flask_mail import Message
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.units import inch
from datetime import datetime
import json

from app import mail

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def send_email(subject, recipients, body, attachments=None):
    """Send email with optional attachments"""
    try:
        msg = Message(
            subject=subject,
            recipients=recipients,
            body=body,
            sender=current_app.config['MAIL_USERNAME']
        )
        
        if attachments:
            for attachment in attachments:
                msg.attach(
                    attachment['filename'],
                    attachment['content_type'],
                    attachment['data']
                )
        
        mail.send(msg)
        return True
    except Exception as e:
        current_app.logger.error(f"Error sending email: {str(e)}")
        return False

def generate_pdf_report(relatorio):
    """Generate PDF report for a given report"""
    try:
        # Create filename - sanitize the project name for file system
        safe_obra_name = "".join(c for c in relatorio.obra.nome if c.isalnum() or c in (' ', '-', '_')).rstrip()
        safe_obra_name = safe_obra_name.replace(' ', '_')
        filename = f"relatorio_{safe_obra_name}_{relatorio.numero_seq:03d}.pdf"
        
        # Ensure upload folder exists
        upload_folder = current_app.config['UPLOAD_FOLDER']
        os.makedirs(upload_folder, exist_ok=True)
        
        filepath = os.path.join(upload_folder, filename)
        
        # Create PDF
        doc = SimpleDocTemplate(filepath, pagesize=A4)
        styles = getSampleStyleSheet()
        story = []
        
        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=18,
            spaceAfter=30,
            alignment=1  # Center
        )
        
        story.append(Paragraph(f"Relatório de Obra #{relatorio.numero_seq:03d}", title_style))
        story.append(Spacer(1, 12))
        
        # Report info table
        report_data = [
            ['Obra:', relatorio.obra.nome],
            ['Data:', relatorio.data.strftime('%d/%m/%Y')],
            ['Responsável:', relatorio.usuario.nome],
            ['Status:', relatorio.status.title()],
        ]
        
        if relatorio.aprovador:
            report_data.append(['Aprovador:', relatorio.aprovador])
        
        report_table = Table(report_data, colWidths=[2*inch, 4*inch])
        report_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.grey),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('BACKGROUND', (1, 0), (1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        story.append(report_table)
        story.append(Spacer(1, 12))
        
        # Activities
        if relatorio.atividades:
            story.append(Paragraph("Atividades Realizadas", styles['Heading2']))
            story.append(Paragraph(relatorio.atividades, styles['Normal']))
            story.append(Spacer(1, 12))
        
        # Checklist
        if relatorio.checklist_data:
            story.append(Paragraph("Checklist", styles['Heading2']))
            checklist_data = []
            for key, value in relatorio.checklist_data.items():
                checklist_data.append([key.replace('_', ' ').title(), value])
            
            checklist_table = Table(checklist_data, colWidths=[3*inch, 3*inch])
            checklist_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.lightblue),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(checklist_table)
            story.append(Spacer(1, 12))
        
        # Photos
        if relatorio.fotos:
            story.append(Paragraph("Fotos Anexadas", styles['Heading2']))
            for foto in relatorio.fotos:
                story.append(Paragraph(f"• {foto.tipo_servico}: {foto.descricao or 'Sem descrição'}", styles['Normal']))
            story.append(Spacer(1, 12))
        
        # Location
        if relatorio.latitude and relatorio.longitude:
            story.append(Paragraph("Localização", styles['Heading2']))
            story.append(Paragraph(f"Coordenadas: {relatorio.latitude:.6f}, {relatorio.longitude:.6f}", styles['Normal']))
        
        # Build PDF
        doc.build(story)
        
        return filename
    
    except Exception as e:
        current_app.logger.error(f"Error generating PDF: {str(e)}")
        return None
