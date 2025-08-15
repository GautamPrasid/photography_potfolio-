document.addEventListener('DOMContentLoaded', function() {
    // Your photo gallery data
    const allPhotos = [
        {
            id: 1,
            url: 'assets/portfolio-1.png',
            category: 'nature',
            description: 'Beautiful mountain landscape',
            title: 'Mountain View'
        },
        {
            id: 2,
            url: 'assets/portfolio-2.png',
            category: 'urban',
            description: 'Urban architecture',
            title: 'City View'
        },
        {
            id: 3,
            url: 'assets/portfolio-3.png',
            category: 'portrait',
            description: 'Portrait photography',
            title: 'Portrait'
        },
        {
            id: 4,
            url: 'assets/portfolio-4.png',
            category: 'travel',
            description: 'Travel photography',
            title: 'Travel'
        },
        {
            id: 5,
            url: 'assets/portfolio-5.png',
            category: 'nature',
            description: 'Nature photography',
            title: 'Nature'
        },
        {
            id: 6,
            url: 'assets/portfolio-6.jpg',

            category: 'blackwhite',
            description: 'Black and white photography',
            title: 'Monochrome'
        },
        {
            id: 7,
            url: 'assets/portfolio-7.png',
            category: 'urban',
            description: 'Urban life',
            title: 'Street'
        },
        {
            id: 8,
            url: 'assets/portfolio-8.jpg',
            category: 'nature',
            description: 'Natural landscape',
            title: 'Landscape View'
        },
        {
            id: 9,
            url: 'assets/portfolio-9.jpg',
            category: 'travel',
            description: 'Travel scene',
            title: 'Journey'
        },
        {
            id: 10,
            url: 'assets/portfolio-10.jpg',
            category: 'portrait',
            description: 'Portrait study',
            title: 'Portrait Art'
        },
        {
            id: 11,
            url: 'assets/portfolio-11.jpg',
            category: 'blackwhite',
            description: 'Monochrome photography',
            title: 'Black & White'
        },
        {
            id: 12,
            url: 'assets/portfolio-12.jpg',
            category: 'urban',
            description: 'City architecture',
            title: 'Urban Landscape'
        }
    ];

    // Mobile menu toggle
    const menuBtn = document.querySelector('.nav__menu__btn');
    const navLinks = document.querySelector('.nav__links');
    
    menuBtn.addEventListener('click', () => {
        navLinks.classList.toggle('active');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav__links') && !e.target.closest('.nav__menu__btn')) {
            navLinks.classList.remove('active');
        }
    });

    // Close menu when window is resized past mobile breakpoint
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            navLinks.classList.remove('active');
        }
    });

    // Close mobile menu when clicking on nav links
    document.querySelectorAll('.nav__links a').forEach(link => {
        link.addEventListener('click', function() {
            navLinks.classList.remove('active');
        });
    });

    // Portfolio Gallery
    const gallery = document.getElementById('gallery');
    const loadMoreBtn = document.getElementById('load-more');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const modal = document.getElementById('photo-modal');
    const modalImg = document.getElementById('modal-image');
    const modalCaption = document.getElementById('modal-caption');
    const closeModal = document.querySelector('.close-modal');
    
    let currentFilter = 'all';
    let photosLoaded = 0;
    const photosPerLoad = 6;  // Show 6 photos per load
    
    // Filter photos by category
    
    // Filter photos by category
    function filterPhotos(category) {
        if (category === 'all') {
            return allPhotos;
        }
        return allPhotos.filter(photo => photo.category === category);
    }
    
    // Load photos into gallery
    function loadPhotos(photos, reset = false) {
        if (reset) {
            gallery.innerHTML = '';
            photosLoaded = 0;
        }
        
        const start = photosLoaded;
        const end = Math.min(photosLoaded + photosPerLoad, photos.length);
        
        for (let i = start; i < end; i++) {
            const photo = photos[i];
            const galleryItem = document.createElement('div');
            galleryItem.className = `gallery-item ${photo.category}`;
            galleryItem.setAttribute('data-category', photo.category);
            galleryItem.innerHTML = `
                <img src="${photo.url}" alt="${photo.description}" loading="lazy">
                <div class="photo-overlay">
                    <p>${photo.description}</p>
                    <span class="photo-category">${photo.category}</span>
                </div>
            `;
            gallery.appendChild(galleryItem);
            
            // Add click event to open modal
            galleryItem.querySelector('img').addEventListener('click', function() {
                modalImg.src = this.src;
                modalCaption.textContent = this.alt;
                modal.style.display = 'block';
                document.body.style.overflow = 'hidden'; // Prevent scrolling when modal is open
            });
        }
        
        photosLoaded = end;
        
        // Hide load more button if all photos are loaded
        if (photosLoaded >= photos.length) {
            loadMoreBtn.style.display = 'none';
        } else {
            loadMoreBtn.style.display = 'block';
        }
    }
    
    // Load more photos
    function loadMorePhotos() {
        const filteredPhotos = filterPhotos(currentFilter);
        loadPhotos(filteredPhotos);
    }
    
    // Initialize gallery
    function initGallery() {
        const filteredPhotos = filterPhotos(currentFilter);
        loadPhotos(filteredPhotos, true);
    }
    
    // Filter button click events
    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Update active filter button
            filterBtns.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Update current filter and reload gallery
            currentFilter = this.getAttribute('data-filter');
            photosLoaded = 0;
            initGallery();
        });
    });
    
    // Load more button event
    loadMoreBtn.addEventListener('click', loadMorePhotos);
    
    // Modal close events
    closeModal.addEventListener('click', function() {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    });
    
    window.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
    
    // Close modal with ESC key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.style.display === 'block') {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
    
    // Initialize the gallery
    initGallery();
});