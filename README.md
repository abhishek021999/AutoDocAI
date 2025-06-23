# AutoDocAI - PDF Annotation Platform

AutoDocAI is a full-stack web application for uploading, annotating, and managing PDF documents. Users can highlight text, add comments, export annotated PDFs, and leverage AI-powered features for summarization and Q&A. Ideal for students, researchers, and professionals collaborating on documents.

---

## Features
- **User Authentication:** Register, login, JWT-based session, user profile management.
- **PDF Upload & Management:** Upload PDFs (max 10MB), stored in AWS S3, with metadata and extracted text in MongoDB.
- **PDF Viewing & Annotation:** View PDFs in-browser, highlight text in multiple colors, add comments, batch operations, export annotated PDFs.
- **Annotation Management:** Create, update, delete, and search annotations; supports highlight color, page, coordinates, and comments.
- **User Library:** List, search, sort, and delete PDFs in a personal library.
- **AI Features:** Summarize PDF content and answer questions about PDF content using Google Gemini API.
- **Smart Search & Filter:** Search PDFs and annotations by text, color, and page.
- **Dark Mode & Responsive UI:** Toggle dark/light themes, mobile-friendly design.
- **Notifications:** Toast notifications for user actions.
- **Security:** Auth middleware, file type/size validation, error handling.

---

## Tech Stack

### Backend
- Node.js, Express
- MongoDB (Mongoose)
- JWT Auth, bcrypt password hashing
- AWS S3 for file storage
- Google Gemini API for AI features
- Multer for file uploads
- PDF processing: pdf-lib, pdf-parse, pdfkit
- Models: User, PDF, Annotation

### Frontend
- React 18, Vite
- Bootstrap & React-Bootstrap
- React-PDF for PDF rendering
- React Router DOM for routing
- React Toastify for notifications
- Axios for API requests

---

## Folder Structure
```
AutoDocAI/
  backend/
    config/         # S3, Firebase config
    middleware/     # Auth middleware
    models/         # User, PDF, Annotation schemas
    routes/         # auth, pdf, annotation, chatbot
    app.js, server.js
  frontend/
    src/
      components/   # Navbar, Footer, etc.
      context/      # Theme context
      pages/        # Home, Dashboard, PDFViewer, UserLibrary, Login, Register
    public/
    index.html
  README.md
```

---

## API Endpoints

### Auth
- `POST /api/auth/register` — Register
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Get current user

### PDFs
- `POST /api/pdfs/upload` — Upload PDF
- `GET /api/pdfs` — List PDFs
- `GET /api/pdfs/:id` — Get PDF details
- `DELETE /api/pdfs/:id` — Delete PDF
- `GET /api/pdfs/:id/export` — Export annotated PDF

### Annotations
- `POST /api/annotations` — Create annotation
- `GET /api/annotations/pdf/:pdfId` — List annotations for a PDF
- `PATCH /api/annotations/:id` — Update annotation
- `DELETE /api/annotations/:id` — Delete annotation
- `GET /api/annotations/search/:pdfId` — Search annotations

### Chatbot (AI)
- `POST /api/chatbot` — Ask questions about PDF content (Gemini API)

---

## Setup & Installation

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (local or Atlas)
- AWS S3 bucket & credentials
- Google Gemini API key

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/autodocai.git
cd AutoDocAI
```

### 2. Backend setup
```bash
cd backend
npm install
# Create .env with:
# PORT=5000
# MONGODB_URI=mongodb://localhost:27017/autodocai
# JWT_SECRET=your_jwt_secret
# AWS_ACCESS_KEY_ID=your_aws_access_key
# AWS_SECRET_ACCESS_KEY=your_aws_secret_key
# AWS_REGION=your_aws_region
# AWS_BUCKET_NAME=your_s3_bucket_name
# GEMINI_API_KEY=your_gemini_api_key
npm run dev
```

### 3. Frontend setup
```bash
cd ../frontend
npm install
# Create .env with:
# VITE_API_URL=http://localhost:5000
npm run dev
```

### 4. Access the app
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Environment Variables
- **Backend:** `PORT`, `MONGODB_URI`, `JWT_SECRET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_BUCKET_NAME`, `GEMINI_API_KEY`
- **Frontend:** `VITE_API_URL`

---

## Development
- Backend: `npm run dev` (nodemon)
- Frontend: `npm run dev` (Vite)

---

## Contributing
Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

---

## License
[MIT](LICENSE)



