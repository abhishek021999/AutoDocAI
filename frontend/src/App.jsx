import { Routes, Route } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import Navbar, { UserProvider } from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import PDFViewer from './pages/PDFViewer';
import UserLibrary from './pages/UserLibrary';
import PrivateRoute from './components/PrivateRoute';
import { ThemeProvider } from './context/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <UserProvider>
        <div className="d-flex flex-column min-vh-100">
          <Navbar />
          <Container className="flex-grow-1 py-4" style={{ marginTop: '56px' }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/dashboard"
                element={
                  <PrivateRoute>
                    <Dashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/library"
                element={
                  <PrivateRoute>
                    <UserLibrary />
                  </PrivateRoute>
                }
              />
              <Route
                path="/pdf/:id"
                element={
                  <PrivateRoute>
                    <PDFViewer />
                  </PrivateRoute>
                }
              />
            </Routes>
          </Container>
          <Footer />
        </div>
      </UserProvider>
    </ThemeProvider>
  );
}

export default App;
