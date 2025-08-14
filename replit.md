# ELP - Gestão de Obras e Relatórios

## Overview

ELP is a comprehensive Progressive Web Application (PWA) for construction project management and reporting. Built with Flask (Python backend) and vanilla HTML/CSS/JavaScript frontend, the system provides role-based access control for administrators and regular users to manage construction projects, generate detailed reports, and track project progress. The application features offline capabilities, geolocation services, and comprehensive reporting with PDF export functionality.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (August 2025)

- **Report Editing for Rejected Reports**: Users can now edit reports that were rejected by administrators, with full approval/rejection history tracking
- **Enhanced PDF Generation**: Fixed image embedding in PDF reports using PIL with proper aspect ratio and centering
- **Admin Workflow History**: Complete history tracking of all approval/rejection actions with reasons and timestamps
- **Sample Data Integration**: Added sample construction photos for testing PDF generation functionality
- **Template Bug Fixes**: Resolved sprintf filter issues in admin reports template

## System Architecture

### Backend Architecture
- **Framework**: Flask web framework with Python
- **Database**: PostgreSQL for scalable data storage with SQLAlchemy ORM
- **Authentication**: Flask-Login for session management with role-based access control (admin/user roles)
- **File Handling**: Werkzeug for secure file uploads with image processing via PIL
- **Email Services**: Flask-Mail for email notifications and report distribution
- **PDF Generation**: ReportLab for automated PDF report creation

### Frontend Architecture
- **Progressive Web App**: Manifest.json and service worker implementation for offline functionality
- **UI Framework**: Bootstrap 5 for responsive design with Font Awesome icons
- **JavaScript**: Vanilla JavaScript organized into modular components (app.js, pwa.js, geolocation.js)
- **Offline Support**: Service worker with caching strategies for static assets and dynamic content
- **Mobile Optimization**: Touch-friendly interface with PWA installation capabilities

### Data Model Design
- **User Management**: User table with role-based permissions and relationship tracking
- **Project Structure**: Obra (construction projects) with status tracking and user assignment
- **Reporting System**: Relatorio table with automatic sequential numbering per project
- **Contact Management**: Contato table linked to projects for stakeholder information
- **File Storage**: Local file system for uploaded photos and generated PDFs

### Security Architecture
- **Password Security**: Werkzeug password hashing for secure credential storage
- **Session Management**: Flask session handling with secure secret key configuration
- **File Upload Security**: Secure filename handling and file type validation
- **Role-Based Access**: Decorator-based admin permissions with route protection

### PWA Features
- **Offline Functionality**: Service worker with multiple caching strategies for network-first and cache-first resources
- **App Installation**: Web app manifest with shortcuts and platform-specific configurations
- **Background Sync**: Pending data synchronization when connection is restored
- **Geolocation Services**: GPS integration for construction site check-ins and location tracking

## External Dependencies

### Core Framework Dependencies
- **Flask**: Web application framework
- **SQLAlchemy**: Database ORM and connection management
- **Flask-Login**: User authentication and session management
- **Flask-Mail**: Email service integration for notifications

### Frontend Libraries
- **Bootstrap 5**: UI component framework from CDN
- **Font Awesome**: Icon library from CDN
- **jsPDF**: Client-side PDF generation from CDN

### Image and File Processing
- **PIL (Pillow)**: Image processing and optimization
- **Werkzeug**: File upload handling and security utilities
- **ReportLab**: Server-side PDF report generation

### Email Services
- **SMTP Configuration**: Gmail SMTP integration with TLS support
- **Environment Variables**: MAIL_SERVER, MAIL_USERNAME, MAIL_PASSWORD for email configuration

### Development and Deployment
- **PostgreSQL**: Production-ready database with connection pooling and pre-ping configuration
- **Replit Platform**: Target deployment environment with integrated PostgreSQL
- **Environment Configuration**: SESSION_SECRET, DATABASE_URL and other environment-based settings

### PWA Infrastructure
- **Service Worker API**: Browser-native offline functionality
- **Web App Manifest**: PWA installation and branding configuration
- **Geolocation API**: Browser-native GPS services for location tracking