// src/HomePage.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import './HomePage.css';

// SVG Icon for the logo
const LogoIcon = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#4A5568" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 17L12 22L22 17" stroke="#4A5568" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 12L12 17L22 12" stroke="#4A5568" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

/* component’s code handles user login, manages email/password state, shows errors, and redirects authenticated users to the dashboard using `useEffect`.
 */
const HomePage = () => {
    // --- Login Logic Start ---
    const navigate = useNavigate();
    const { user, login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const FLASK_BACKEND_URL = process.env.REACT_APP_FLASK_BACKEND_URL;

    // Redirect to dashboard if the user is already authenticated
    useEffect(() => {
        if (user) {
            navigate('/dashboard', { replace: true });
        }
    }, [user, navigate]);

    const handleGoogleCredentialResponse = useCallback(async (response) => {
        setErrorMessage('');
        if (!response.credential) {
            setErrorMessage('Google login failed: No credential received.');
            return;
        }
        try {
            // Corrected: Using backticks (`) for template literal.
            const res = await fetch(`${FLASK_BACKEND_URL}/auth/google_login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: response.credential }),
            });
            const data = await res.json();
            if (data.success && data.user && data.access_token) {
                login(data.user, data.access_token);
            } else {
                setErrorMessage(data.error || 'Google login failed.');
            }
        } catch (error) {
            setErrorMessage('Network error or server unavailable.');
        }
    }, [login, FLASK_BACKEND_URL, navigate]);



    /*`useEffect` dynamically loads the Google Sign-In script, initializes the client with a callback, 
    renders the button, and cleans up on unmount. */
    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            if (window.google?.accounts?.id) {
                window.google.accounts.id.initialize({
                    client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
                    callback: handleGoogleCredentialResponse,
                });
                window.google.accounts.id.renderButton(
                    document.getElementById('googleSignInButton'),
                    { theme: 'outline', size: 'large', type: 'standard', text: 'signin_with' }
                );
            }
        };
        document.body.appendChild(script);
        return () => {
            document.querySelector('script[src="https://accounts.google.com/gsi/client"]')?.remove();
        };
    }, [handleGoogleCredentialResponse]);


    /* function handles email login by sending credentials to the backend, processing the response, 
    updating authentication state, and showing errors. */
    const handleEmailLogin = async (e) => {
        e.preventDefault();
        setErrorMessage('');
        try {
            // Corrected: Using backticks (`) for template literal.
            const res = await fetch(`${FLASK_BACKEND_URL}/auth/email_login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (data.success && data.user && data.access_token) {
                login(data.user, data.access_token);
            } else {
                setErrorMessage(data.error || 'Invalid email or password.');
            }
        } catch (error) {
            setErrorMessage('Network error or server unavailable.');
        }
    };


    // --- Login Logic End ---


    const aboutRef = useRef(null);
    const servicesRef = useRef(null);
    const contactRef = useRef(null);

    const scrollToSection = (ref) => {
        window.scrollTo({ top: ref.current.offsetTop - 80, behavior: 'smooth' });
    };
    
    /*This `useEffect` uses an `IntersectionObserver` to toggle the `'visible'` class on sections when they enter or leave the viewport, enabling scroll animations.
 */
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) entry.target.classList.add('visible');
                else entry.target.classList.remove('visible');
            });
        }, { threshold: 0.1 });

        const sections = [aboutRef, servicesRef, contactRef];
        sections.forEach((ref) => { if (ref.current) observer.observe(ref.current); });
        return () => { sections.forEach((ref) => { if (ref.current) observer.unobserve(ref.current); }); };
    }, []);

    return (
        <div className="pageWrapper">
            <div className="pageContainer">
                <nav className="navbar">
                    <div className="nav-logo"><LogoIcon /><span>CONTENT ORCHESTRATION</span></div>
                    <div className="nav-links">
                        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Home</button>
                        <button onClick={() => scrollToSection(aboutRef)}>About</button>
                        <button onClick={() => scrollToSection(servicesRef)}>Service</button>
                        <button onClick={() => scrollToSection(contactRef)}>Contact</button>
                    </div>
                </nav>
            </div>

            <div className="heroSlideshowContainer">
                <div className="heroContent">
                    <div className="heroText">
                        <h1>Welcome To Content Orchestration</h1>
                        <p>Unlock the true potential of your multimedia assets. Our AI powered platform automatically analyzes, enriches, and organizes your content for effortless discovery.</p>
                    </div>

                    <div className="heroLoginContainer">
                        <div className="heroLoginHeader">
                            <h1>Welcome Back</h1>
                            <h2>Log in to access your cloud</h2>
                        </div>
                        <div className="google-button-wrapper">
                            <div id="googleSignInButton"></div>
                        </div>
                        <div className="divider">Or continue with email</div>
                        <form onSubmit={handleEmailLogin} className="heroLoginForm">
                            <div className="form-group">
                                <label className="form-label" htmlFor="email">Email</label>
                                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="form-input" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="password">Password</label>
                                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="form-input" required />
                            </div>
                            <div className="forgot-password">
                                <a href="#/">Forgot password?</a>
                            </div>
                            {errorMessage && <p className="error-message">{errorMessage}</p>}
                            <button type="submit" className="submit-button">Sign In</button>
                        </form>
                    </div>
                </div>
            </div>

            <div className="pageContainer">
                <div className="featuresContainer">
                    <section className="featuresSection">
                        <div className="feature">
                            <h3>Effortless Upload</h3>
                            <p>Easily upload any file type to our secure cloud storage.</p>
                        </div>
                        <div className="feature">
                            <h3>Automated AI Analysis</h3>
                            <p>Our AI processes your content, transcribing audio and recognizing objects.</p>
                        </div>
                        <div className="feature">
                            <h3>Generative AI Enrichment</h3>
                            <p>Receive smart summaries and relevant tags for all your content.</p>
                        </div>
                        <div className="feature">
                            <h3>Instant Discovery</h3>
                            <p>Find exactly what you need with our powerful, indexed search.</p>
                        </div>
                    </section>
                </div>

                <section ref={aboutRef} className="infoSection">
                    <div className="infoSectionContent">
                        <div className="infoText">
                            <h2>About Platform</h2>
                            <p>
                                The "Intelligent Content Orchestration & Discovery Platform" aims to address critical challenges faced by digital content providers, such as manual metadata tagging, poor content discoverability, and slow time-to-market. This platform provides an end-to-end solution that automates content analysis using advanced AI services, enriches metadata with generative AI, and enables intelligent content search through a modern web application.
                            </p>
                        </div>
                        <div className="infoImage">
                            <img src="/bio4.jpg" alt="AI-powered content orchestration and analysis" />
                        </div>
                    </div>
                </section>

                <section ref={servicesRef} className="infoSection">
                    <div className="infoSectionContent">
                        <div className="infoText">
                            <h2>Our Services</h2>
                            <p>
                                Our workflow is a series of interconnected, event-driven stages, ensuring efficient and scalable processing of multimedia content.
                            </p>
                            <ul>
                                <li><strong>Content Ingestion:</strong> Seamlessly upload raw multimedia content and trigger the automated processing pipeline.</li>
                                <li><strong>AI Content Analysis:</strong> Raw content is processed by specialized AI services and further enriched by generative AI for summaries and tags.</li>
                                <li><strong>Metadata Storage & Indexing:</strong> Enriched metadata is stored efficiently in a NoSQL database for quick retrieval.</li>
                                <li><strong>Content Discovery:</strong> A user-friendly web application enables intuitive content search and consumption.</li>
                            </ul>
                        </div>
                        <div className="infoImage">
                            <img src="/bio5.jpg" alt="Cloud Services" />
                        </div>
                    </div>
                </section>

                <section ref={contactRef} className="infoSection">
                    <div className="infoSectionContent">
                        <div className="infoText">
                            <h2>Get In Touch</h2>
                            <p>
                                Have a question or want to learn more? Send us a message, and we'll get back to you as soon as possible.
                            </p>
                            <form className="contactForm">
                                <input type="text" placeholder="Your Name" required />
                                <input type="email" placeholder="Your Email" required />
                                <textarea placeholder="Your Message" rows="5" required></textarea>
                                <button type="submit" className="btn btn-primary">Send Message</button>
                            </form>
                        </div>
                        <div className="infoImage">
                            <img src="/bio6.jpg" alt="Contact Us" />
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default HomePage;
