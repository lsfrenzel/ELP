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

def send_email(to_email, subject, template=None, **kwargs):
    """Send email with template support"""
    try:
        # Simple implementation - in production you'd use proper templates
        if template and 'approved' in template:
            body = f"""
Seu relatório foi APROVADO!

Obra: {kwargs.get('relatorio').obra.nome}
Relatório: #{kwargs.get('relatorio').numero_seq}
Data: {kwargs.get('relatorio').data.strftime('%d/%m/%Y')}

{kwargs.get('observacoes', '')}

Este é um email automático do sistema ELP Obras.
            """
        elif template and 'rejected' in template:
            body = f"""
Seu relatório foi REPROVADO e precisa de correções.

Obra: {kwargs.get('relatorio').obra.nome}
Relatório: #{kwargs.get('relatorio').numero_seq}
Data: {kwargs.get('relatorio').data.strftime('%d/%m/%Y')}

Motivo da reprovação:
{kwargs.get('observacoes', '')}

Prazo para revisão: {kwargs.get('prazo_revisao').strftime('%d/%m/%Y') if kwargs.get('prazo_revisao') else 'N/A'}

Por favor, faça as correções necessárias e reenvie o relatório.

Este é um email automático do sistema ELP Obras.
            """
        else:
            body = f"Notificação do sistema ELP Obras: {subject}"

        msg = Message(
            subject=subject,
            recipients=[to_email],
            body=body,
            sender=current_app.config.get('MAIL_USERNAME', 'noreply@elp.com')
        )
        
        if current_app.config.get('MAIL_USERNAME'):
            mail.send(msg)
            return True
        else:
            current_app.logger.info(f"Email would be sent to {to_email}: {subject}")
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
        
        # Photos section with actual photo embedding
        if relatorio.fotos:
            from reportlab.platypus import Image
            story.append(Paragraph("Fotos Anexadas", styles['Heading2']))
            
            for foto in relatorio.fotos:
                story.append(Paragraph(f"<b>{foto.tipo_servico}</b>", styles['Normal']))
                if foto.descricao:
                    story.append(Paragraph(foto.descricao, styles['Normal']))
                
                # Try to include actual photo in PDF
                try:
                    photo_path = os.path.join(upload_folder, foto.caminho_arquivo)
                    if os.path.exists(photo_path):
                        # Check if it's a valid image and resize it
                        from PIL import Image as PILImage
                        
                        # Open and process the image
                        with PILImage.open(photo_path) as pil_img:
                            # Convert to RGB if necessary (for JPEG output)
                            if pil_img.mode in ('RGBA', 'LA', 'P'):
                                pil_img = pil_img.convert('RGB')
                            
                            # Calculate aspect ratio and resize
                            max_width = 4 * inch
                            max_height = 3 * inch
                            
                            img_width, img_height = pil_img.size
                            aspect_ratio = img_width / img_height
                            
                            if aspect_ratio > max_width / max_height:
                                # Image is wider - fit to width
                                new_width = max_width
                                new_height = max_width / aspect_ratio
                            else:
                                # Image is taller - fit to height
                                new_height = max_height
                                new_width = max_height * aspect_ratio
                            
                            # Add the image to PDF
                            try:
                                img = Image(photo_path, width=new_width, height=new_height)
                                img.hAlign = 'CENTER'
                                story.append(img)
                                story.append(Spacer(1, 6))
                                current_app.logger.info(f"Successfully added image to PDF: {foto.caminho_arquivo}")
                            except Exception as img_add_error:
                                story.append(Paragraph(f"Erro ao inserir imagem: {foto.caminho_arquivo}", styles['Normal']))
                                current_app.logger.error(f"Error adding image to PDF: {str(img_add_error)}")
                    else:
                        story.append(Paragraph(f"Arquivo: {foto.caminho_arquivo} (não encontrado)", styles['Normal']))
                        current_app.logger.warning(f"Image file not found: {photo_path}")
                except Exception as img_error:
                    story.append(Paragraph(f"Erro ao carregar imagem: {foto.caminho_arquivo}", styles['Normal']))
                    current_app.logger.error(f"Error loading image in PDF: {str(img_error)}")
                
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
