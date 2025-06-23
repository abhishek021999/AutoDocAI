import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Navbar as BootstrapNavbar, Nav, Container, Button } from 'react-bootstrap';
import { useState, useEffect, createContext, useContext } from 'react';
import { useTheme } from '../context/ThemeContext';

// Create UserContext
export const UserContext = createContext();

// Create UserProvider component
export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const updateUser = (userData) => {
    setUser(userData);
    setIsAuthenticated(!!userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setIsAuthenticated(false);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch(`${import.meta.env.VITE_API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            updateUser(data.user);
          }
        })
        .catch(() => {
          logout();
        });
    }
  }, []);

  return (
    <UserContext.Provider value={{ user, isAuthenticated, updateUser, logout }}>
      {children}
    </UserContext.Provider>
  );
}

function Navbar() {
  const { user, isAuthenticated, logout } = useContext(UserContext);
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <BootstrapNavbar 
      bg="primary" 
      variant="dark" 
      expand="lg" 
      fixed="top"
      style={{
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        zIndex: 1030
      }}
    >
      <Container>
        <BootstrapNavbar.Brand as={Link} to="/">AutoDoc</BootstrapNavbar.Brand>
        <BootstrapNavbar.Toggle aria-controls="basic-navbar-nav" />
        <BootstrapNavbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link 
              as={Link} 
              to="/" 
              className={isActive('/') ? 'active fw-bold' : ''}
            >
              Home
            </Nav.Link>
            {isAuthenticated && (
              <>
                <Nav.Link 
                  as={Link} 
                  to="/dashboard" 
                  className={isActive('/dashboard') ? 'active fw-bold' : ''}
                >
                  Dashboard
                </Nav.Link>
                <Nav.Link 
                  as={Link} 
                  to="/library" 
                  className={isActive('/library') ? 'active fw-bold' : ''}
                >
                  Library
                </Nav.Link>
              </>
            )}
          </Nav>
          <Nav>
            <Button
              variant="outline-light"
              className="me-3"
              onClick={toggleTheme}
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              <i className={`bi bi-${isDarkMode ? 'sun' : 'moon'}-fill`}></i>
            </Button>
            {isAuthenticated ? (
              <>
                <span className="navbar-text me-3 d-flex align-items-center" style={{ color: 'white' }}>
                  <i className="bi bi-person-circle me-2"></i>
                  Welcome, <span className="fw-bold ms-1">{user?.name}</span>
                </span>
                <Button variant="outline-light" onClick={handleLogout}>
                  <i className="bi bi-box-arrow-right me-1"></i>
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Nav.Link 
                  as={Link} 
                  to="/login"
                  className={isActive('/login') ? 'active fw-bold' : ''}
                >
                  Login
                </Nav.Link>
                <Nav.Link 
                  as={Link} 
                  to="/register"
                  className={isActive('/register') ? 'active fw-bold' : ''}
                >
                  Register
                </Nav.Link>
              </>
            )}
          </Nav>
        </BootstrapNavbar.Collapse>
      </Container>
    </BootstrapNavbar>
  );
}

export default Navbar; 