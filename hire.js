// Function to create floating background elements
function createFloatingElements() {
    const container = document.getElementById('floatingElements');
    const colors = [
        'rgba(0, 0, 0, 0.08)', 
        'rgba(118, 114, 104, 0.1)', 
        'rgba(0, 0, 0, 0.06)',
        'rgba(238, 249, 248, 0.8)',
        'rgba(118, 114, 104, 0.15)'
    ];
    
    for (let i = 0; i < 15; i++) {
        const element = document.createElement('div');
        element.classList.add('floating-element');
        
        // Random properties for each element
        const size = Math.random() * 100 + 50;
        const posX = Math.random() * 100;
        const posY = Math.random() * 100;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const delay = Math.random() * 15;
        const duration = 10 + Math.random() * 20;
        
        element.style.width = `${size}px`;
        element.style.height = `${size}px`;
        element.style.left = `${posX}%`;
        element.style.top = `${posY}%`;
        element.style.background = color;
        element.style.animationDelay = `${delay}s`;
        element.style.animationDuration = `${duration}s`;
        
        container.appendChild(element);
    }
}

// Mobile menu functionality
function setupMobileMenu() {
    const menuBtn = document.getElementById('menu-btn');
    const navLinks = document.getElementById('nav-links');
    const menuBtnIcon = menuBtn.querySelector("i");
    
    if (menuBtn && navLinks && menuBtnIcon) {
        menuBtn.addEventListener('click', (e) => {
            navLinks.classList.toggle('open');
            
            const isOpen = navLinks.classList.contains('open');
            menuBtnIcon.setAttribute(
                'class',
                isOpen ? 'ri-close-line' : 'ri-menu-3-line'
            );
        });
        
        // Close menu when clicking on a link
        const links = navLinks.querySelectorAll('a');
        links.forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('open');
                menuBtnIcon.setAttribute('class', 'ri-menu-3-line');
            });
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!menuBtn.contains(e.target) && !navLinks.contains(e.target)) {
                navLinks.classList.remove('open');
                menuBtnIcon.setAttribute('class', 'ri-menu-3-line');
            }
        });
    }
}

// Navbar scroll effect
function handleScroll() {
    const nav = document.querySelector('nav');
    if (window.scrollY > 50) {
        nav.classList.add('scrolled');
    } else {
        nav.classList.remove('scrolled');
    }
}

// Simple button hover effects (CSS handles the main hover effect)
function addButtonEffects() {
    const buttons = document.querySelectorAll('.contact a');
    
    buttons.forEach(button => {
        button.addEventListener('mouseenter', () => {
            // The transform is handled by CSS :hover, but you could add more JS logic here if needed.
        });
        
        button.addEventListener('mouseleave', () => {
            // The transform is handled by CSS :hover
        });
    });
}

// Parallax effect for the profile image on mouse move
function setupParallax() {
    const profileImg = document.getElementById('profileImage');
    const hireMeSection = document.querySelector('.hire-me');
    
    if (profileImg && hireMeSection) {
        hireMeSection.addEventListener('mousemove', (e) => {
            const rect = hireMeSection.getBoundingClientRect();
            const x = (e.clientX - rect.left - rect.width / 2) / 20;
            const y = (e.clientY - rect.top - rect.height / 2) / 20;

            // Apply a subtle 3D tilt effect
            profileImg.style.transform = `perspective(1000px) rotateY(${x}deg) rotateX(${-y}deg) scale(1.05)`;
        });

        hireMeSection.addEventListener('mouseleave', () => {
            // Reset transform when mouse leaves the section
            profileImg.style.transform = `perspective(1000px) rotateY(0) rotateX(0) scale(1)`;
        });
    }
}

// Update the year in the footer
function updateYear() {
    const yearElement = document.getElementById('year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
}

// Optional Typewriter effect for the main heading
function typeWriterEffect() {
    const text = "Hire Me for Your Next Project";
    const h1 = document.querySelector('.hire-me h1');
    if (h1) {
        let i = 0;
        
        h1.textContent = ''; // Clear existing text
        h1.style.opacity = 1; // Ensure it's visible
        
        function type() {
            if (i < text.length) {
                h1.textContent += text.charAt(i);
                i++;
                setTimeout(type, 100);
            }
        }
        
        type();
    }
}

// Initialize all functions when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    createFloatingElements();
    setupMobileMenu(); // Add mobile menu functionality
    window.addEventListener('scroll', handleScroll);
    addButtonEffects();
    setupParallax();
    updateYear();
    
    // Uncomment the line below to activate the typewriter effect
    // setTimeout(typeWriterEffect, 1000); 
    
    // Add click animation (ripple effect) to all buttons
    const buttons = document.querySelectorAll('.contact a, .socials a');
    buttons.forEach(button => {
        button.addEventListener('click', (e) => {
            // Check if it's a mailto or tel link - these should work normally
            if (button.href && (button.href.startsWith('mailto:') || button.href.startsWith('tel:'))) {
                // For email and phone links, just add ripple effect but don't prevent default
                // Create the ripple element
                const ripple = document.createElement('span');
                ripple.classList.add('ripple');
                
                // Calculate position relative to the button
                const rect = button.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                ripple.style.width = ripple.style.height = `${size}px`;
                ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
                ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
                
                button.appendChild(ripple);
                
                // Remove the ripple element after the animation completes
                setTimeout(() => {
                    ripple.remove();
                }, 600);
                
                // Let the default behavior happen (open email client or phone app)
                return;
            }
            
            // For other links (social media), prevent default and handle manually
            e.preventDefault();
            
            // Create the ripple element
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            
            // Calculate position relative to the button
            const rect = button.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            ripple.style.width = ripple.style.height = `${size}px`;
            ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
            ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
            
            button.appendChild(ripple);
            
            // Remove the ripple element after the animation completes
            setTimeout(() => {
                ripple.remove();
            }, 600);
            
            // Proceed to the link's destination after a short delay
            setTimeout(() => {
                if (button.href && button.href !== window.location.href + '#') {
                    window.open(button.href, '_blank');
                }
            }, 300);
        });
    });
});