import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import styles from './Dashboard.module.css';
import {
    FiSearch, FiUploadCloud, FiFileText, FiVideo, FiMusic, FiX, FiPaperclip,
    FiArrowLeft, FiDownload, FiTrash2, FiImage, FiFilm, FiHeadphones, FiFile,
    FiGrid, FiChevronDown
} from 'react-icons/fi';

const Dashboard = () => {
    const { user, logout, getToken } = useAuth();
    const navigate = useNavigate();

    // STATE
    const [currentView, setCurrentView] = useState('search'); // Toggle between 'search' and 'upload'
    const [selectedFile, setSelectedFile] = useState(null); // Files selected for upload
    const [uploading, setUploading] = useState(false); // Upload status
    const [uploadMessage, setUploadMessage] = useState(''); // Upload success/error message
    const [searchQuery, setSearchQuery] = useState(''); // User search input
    const [searchResults, setSearchResults] = useState([]); // Filtered search results
    const [searchMessage, setSearchMessage] = useState(''); // Search status message
    const [searching, setSearching] = useState(false); // Search in-progress state
    const [frequentKeywords, setFrequentKeywords] = useState([]); // Common keywords from backend
    const [keywordsLoading, setKeywordsLoading] = useState(true); // Loading keywords
    const [unfilteredSearchResults, setUnfilteredSearchResults] = useState([]); // Raw API results
    const [filterCategory, setFilterCategory] = useState('All'); // File filter (All, Images, Videos, etc.)
    const [isFilterOpen, setIsFilterOpen] = useState(false); // Filter dropdown toggle

    // Deployment-ready backend URL
    const FLASK_BACKEND_URL = process.env.NODE_ENV === 'development'
        ? process.env.REACT_APP_FLASK_BACKEND_URL // Use localhost in dev
        : window.location.origin; // Use the current domain in production
        
    const filterRef = useRef(null);


    /* This code defines an array of filter options with labels, values, and icons for categorizing content types like images, videos, audios.
 */
    const filterOptions = [
        { name: 'All Types', value: 'All', icon: <FiGrid size={16} /> },
        { name: 'Images', value: 'Images', icon: <FiImage size={16} /> },
        { name: 'Videos', value: 'Videos', icon: <FiFilm size={16} /> },
        { name: 'Audios', value: 'Audios', icon: <FiHeadphones size={16} /> },
        { name: 'Others', value: 'Others', icon: <FiFile size={16} /> },
    ];

    // useEffect to close dropdown on outside click
    /*  `useEffect` closes the filter dropdown when a user clicks outside its area, ensuring proper UI behavior and cleanup.
 */
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (filterRef.current && !filterRef.current.contains(event.target)) {
                setIsFilterOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [filterRef]);


    // useEffect to fetch keywords
    /*This `useEffect` fetches frequent keywords from the Flask backend when a user exists, handles authentication, errors, and updates loading state.
 */
    useEffect(() => {
        const fetchKeywords = async () => {
            setKeywordsLoading(true);
            try {
                const token = getToken();
                if (!token) {
                    console.error("No token found for fetching keywords.");
                    setKeywordsLoading(false);
                    return;
                }
                const res = await fetch(`${FLASK_BACKEND_URL}/frequent_keywords`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    setFrequentKeywords(data.keywords);
                } else {
                    console.error("Failed to fetch keywords:", data.error || "Unknown error");
                    setFrequentKeywords([]);
                }
            } catch (error) {
                console.error("API error while fetching keywords:", error);
                setFrequentKeywords([]);
            } finally {
                setKeywordsLoading(false);
            }
        };
        if (user) {
          fetchKeywords();
        }
    }, [user, getToken, FLASK_BACKEND_URL]);

    // useEffect to apply filtering when category changes
    useEffect(() => {
        if (filterCategory === 'All') {
            setSearchResults(unfilteredSearchResults);
            return;
        }

        const filtered = unfilteredSearchResults.filter(file => {
            const contentType = file.enrichedMetadata?.contentType || '';
            if (filterCategory === 'Images') return contentType.startsWith('image/');
            if (filterCategory === 'Videos') return contentType.startsWith('video/');
            if (filterCategory === 'Audios') return contentType.startsWith('audio/');
            if (filterCategory === 'Others') {
                return !contentType.startsWith('image/') &&
                       !contentType.startsWith('video/') &&
                       !contentType.startsWith('audio/');
            }
            return true;
        });

        setSearchResults(filtered);
    }, [filterCategory, unfilteredSearchResults]);


    // HELPER FUNCTIONS
    const showUploadView = () => setCurrentView('upload');
    const showSearchView = () => setCurrentView('search');

    const handleLogout = () => {
        logout();
        navigate('/login');
    };
    /*This function converts a file size in bytes to a human-readable format (Bytes, KB, MB, GB) with two decimal precision. */
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };


    /*This function updates the selected file state from the input and clears any previous upload messages when a new file is chosen. */
    const handleFileChange = (event) => {
        setSelectedFile(event.target.files);
        setUploadMessage('');
    };

    /*This function clears the selected file state and resets the file input element, allowing users to choose a new file.
 */ 
    const clearSelectedFile = () => {
        setSelectedFile(null);
        const fileInput = document.getElementById('file-upload-input');
        if (fileInput) {
            fileInput.value = null;
        }
    };

    /*This function removes a specific file from the selected files list, updating state and clearing input if no files remain.
 */
    const removeFileFromList = (fileToRemove) => {
        const newFileList = Array.from(selectedFile).filter(file => file !== fileToRemove);
        if (newFileList.length === 0) {
            clearSelectedFile();
        } else {
            const dataTransfer = new DataTransfer();
            newFileList.forEach(file => dataTransfer.items.add(file));
            setSelectedFile(dataTransfer.files);
        }
    };

    // API HANDLERS
    /*This function uploads selected files to the backend with authentication, handles success, errors, and updates UI states like uploading and messages.
 */
    const handleFileUpload = async () => {
        if (!selectedFile || selectedFile.length === 0) {
            setUploadMessage('Please select one or more files first!');
            return;
        }
        setUploading(true);
        setUploadMessage('Uploading...');
        const formData = new FormData();
        for (const file of selectedFile) {
            formData.append('file', file);
        }

        try {
            const token = getToken();
            if (!token) {
                setUploadMessage('No authentication token found. Please login again.');
                setUploading(false);
                return;
            }
            const res = await fetch(`${FLASK_BACKEND_URL}/upload_files`, {
                method: 'POST',
                body: formData,
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setUploadMessage('Files uploaded successfully!');
                clearSelectedFile();
            } else {
                setUploadMessage(`Upload failed: ${data.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error("An error occurred during the upload process:", error);
            setUploadMessage('An error occurred. Please check the console.');
        } finally {
            setUploading(false);
        }
    };
    
    /*This function performs a file search using a query, handles authentication, updates search results, 
    manages errors, and provides user feedback messages. */
    const performSearch = async (query) => {
        if (!query.trim()) {
            setSearchMessage('Please enter a filename, keyword, or file extension to search.');
            setUnfilteredSearchResults([]);
            setSearchResults([]);
            return;
        }
        setSearching(true);
        setSearchMessage('Searching...');
        setUnfilteredSearchResults([]);
        setSearchResults([]);

        try {
            const token = getToken();
            if (!token) {
                setSearchMessage('No authentication token found. Please login again.');
                setSearching(false);
                return;
            }
            const url = `${FLASK_BACKEND_URL}/search_files?searchQuery=${encodeURIComponent(query.trim())}`;
            const res = await fetch(url, {
                method: 'GET',
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok && data.success) {
                if (data.results && data.results.length > 0) {
                    setUnfilteredSearchResults(data.results);
                    setSearchResults(data.results);
                    setFilterCategory('All');
                    setSearchMessage('');
                } else {
                    setSearchResults([]);
                    setUnfilteredSearchResults([]);
                    setSearchMessage('No files found matching your criteria.');
                }
            } else {
                setSearchResults([]);
                setUnfilteredSearchResults([]);
                setSearchMessage(data.error || 'An error occurred during search.');
            }
        } catch (error) {
            console.error('Search API call error:', error);
            setSearchMessage('Network error or server unavailable during search.');
        } finally {
            setSearching(false);
        }
    };
    /*This function prevents the default form submission and triggers the `performSearch` function using the current search query. */
    const handleSearchSubmit = (e) => {
        e.preventDefault();
        performSearch(searchQuery);
    };
    /*This function sets the search input to the clicked keyword and immediately triggers a search using that keyword.
 */
    const handleKeywordClick = (keyword) => {
        setSearchQuery(keyword.name);
        performSearch(keyword.name);
    };

    
    /*This function downloads all search result files as a ZIP, handling authentication, 
    API requests, errors, and providing user feedback messages. */
    const handleDownloadAll = async () => {
        if (searchResults.length === 0) {
            return;
        }
        setSearchMessage('Preparing files for download...');
        try {
            const token = getToken();
            const fileUrls = searchResults.map(file => file.publicUrl);
            const res = await fetch(`${FLASK_BACKEND_URL}/download_selected_files`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ fileUrls: fileUrls })
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'search_results.zip';
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                setSearchMessage('All files downloaded successfully!');
            } else {
                const errorData = await res.json();
                setSearchMessage(`Download failed: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Download all API call error:', error);
            setSearchMessage('Network error or server unavailable during bulk download.');
        }
    };
    
    /*This function downloads a single file from the backend, handling authentication, errors, and creating a temporary link to trigger the browser download.
 */
    const handleSingleFileDownload = async (file) => {
        try {
            const token = getToken();
            const res = await fetch(`${FLASK_BACKEND_URL}/download_single_file`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    fileUrl: file.publicUrl,
                    originalFileName: file.enrichedMetadata.originalFileName,
                }),
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.enrichedMetadata.originalFileName;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } else {
                const errorData = await res.json();
                setSearchMessage(`Download failed for ${file.enrichedMetadata.originalFileName}: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Single file download error:', error);
            setSearchMessage('An error occurred during download. Check the console.');
        }
    };
    
    /*This function deletes a selected file after user confirmation, handling authentication, updating search results, 
    and showing success or error messages. */
    const handleDeleteFile = async (fileToDelete) => {
        const filename = fileToDelete.enrichedMetadata.originalFileName;
        if (!window.confirm(`Are you sure you want to delete "${filename}"?`)) {
            return;
        }

        try {
            const token = getToken();
            const res = await fetch(`${FLASK_BACKEND_URL}/delete_file`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ filename: filename }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setSearchMessage(`Successfully deleted "${filename}".`);
                setUnfilteredSearchResults(prevResults => prevResults.filter(file => file.publicUrl !== fileToDelete.publicUrl));
            } else {
                setSearchMessage(`Failed to delete file: ${data.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Delete file error:', error);
            setSearchMessage('An error occurred during deletion.');
        }
    };

    /*This function renders a file’s thumbnail if it’s an image, or an appropriate icon for videos, audios, and other file types. */
    const renderFileIconOrThumbnail = (file) => {
        const contentType = file.enrichedMetadata?.contentType || '';
        if (contentType.startsWith('image/')) {
            return <div className={styles['file-thumbnail-container']}><img src={file.publicUrl} alt={file.enrichedMetadata.originalFileName} className={styles['file-thumbnail']} /></div>;
        } else if (contentType.startsWith('video/')) {
            return <div className={styles['file-thumbnail-container']}><FiVideo className={styles['file-icon-small']} /></div>;
        } else if (contentType.startsWith('audio/')) {
            return <div className={styles['file-thumbnail-container']}><FiMusic className={styles['file-icon-small']} /></div>;
        } else {
            return <div className={styles['file-thumbnail-container']}><FiFileText className={styles['file-icon-small']} /></div>;
        }
    };

    if (!user) {
        return <Navigate to="/login" />;
    }

    return (
        <div className={styles['dashboard-page']}>
            <header className={styles['dashboard-header']}>
                <h2 className={styles['welcome-message']}>
                    Welcome, <span>{user.name || user.email}</span>
                </h2>
                <button onClick={handleLogout} className={styles['logout-button']}>
                    Logout
                </button>
            </header>
            <main>
                {currentView === 'search' ? (
                    <div className={styles['view-container']}>
                        <div className={styles['top-actions-container']}>
                            <button onClick={showUploadView} className={styles['upload-button-main']}>
                                <FiUploadCloud /> Upload New File(s)
                            </button>
                        </div>
                        <div className={styles['dashboard-container']}>
                            <div className={styles['card-header']}>
                                <FiSearch className={styles['card-icon']} />
                                <h3>Search Your Files</h3>
                            </div>
                            <p className={styles['card-description']}>Find any file in your personal cloud instantly.</p>
                            <form onSubmit={handleSearchSubmit} className={styles['search-input-group']}>
                                <input
                                    type="text"
                                    placeholder="e.g., my_image.png"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className={styles['dashboard-form-input']}
                                />
                                <button type="submit" disabled={searching} className={styles['dashboard-action-button']}>
                                    {searching ? '...' : 'Search'}
                                </button>
                            </form>
                            <div className={styles['keywords-container']}>
                                {keywordsLoading ? (
                                    <p className={styles['keywords-loading']}>Loading popular keywords...</p>
                                ) : frequentKeywords.length > 0 ? (
                                    <div className={styles['keywords-grid']}>
                                        {frequentKeywords.map((keyword) => (
                                            <button key={keyword.name} onClick={() => handleKeywordClick(keyword)} className={styles['keyword-button']}>
                                                {keyword.name} <span className={styles['keyword-count']}>{keyword.count}</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className={styles['keywords-loading']}>No popular keywords found yet. Upload more files!</p>
                                )}
                            </div>
                            <div className={styles['files-section']}>
                                <div className={styles['files-header']}>
                                    <div className={styles['filter-container']} ref={filterRef}>
                                        <button
                                            onClick={() => setIsFilterOpen(prev => !prev)}
                                            className={styles['filter-button']}
                                            disabled={unfilteredSearchResults.length === 0}
                                        >
                                            {filterOptions.find(opt => opt.value === filterCategory)?.icon}
                                            <span>{filterOptions.find(opt => opt.value === filterCategory)?.name}</span>
                                            <FiChevronDown className={`${styles['filter-chevron']} ${isFilterOpen ? styles['open'] : ''}`} />
                                        </button>
                                        {isFilterOpen && (
                                            <div className={styles['filter-menu']}>
                                                {filterOptions.map(option => (
                                                    <div
                                                        key={option.value}
                                                        className={styles['filter-option']}
                                                        onClick={() => {
                                                            setFilterCategory(option.value);
                                                            setIsFilterOpen(false);
                                                        }}
                                                    >
                                                        {option.icon}
                                                        <span>{option.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <h4>Files ({searchResults.length})</h4>
                                    {searchResults.length > 0 && (
                                        <button onClick={handleDownloadAll} className={styles['header-download-button']}>
                                            <FiDownload /> Download All
                                        </button>
                                    )}
                                </div>
                                <div className={styles['files-list']}>
                                    {searching ? (
                                        <p className={styles['files-list-placeholder']}>Searching...</p>
                                    ) : unfilteredSearchResults.length > 0 ? (
                                        searchResults.length > 0 ? (
                                            searchResults.map((file, index) => (
                                                <div key={index} className={styles['file-item']}>
                                                    <div className={styles['file-info']}>
                                                        {renderFileIconOrThumbnail(file)}
                                                        <span>{file.enrichedMetadata.originalFileName}</span>
                                                    </div>
                                                    <div className={styles['file-actions']}>
                                                        <button onClick={() => handleDeleteFile(file)} className={styles['delete-button']} title="Delete File">
                                                            <FiTrash2 />
                                                        </button>
                                                        <button onClick={() => handleSingleFileDownload(file)} className={styles['download-button']} title="Download File">
                                                            <FiDownload />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className={styles['files-list-placeholder']}>
                                                No files match the "<strong>{filterCategory}</strong>" filter.
                                            </p>
                                        )
                                    ) : (
                                        <p className={styles['files-list-placeholder']}>
                                            {searchMessage || 'Search for a file to see results here.'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className={styles['view-container']}>
                        <button onClick={showSearchView} className={styles['back-button']}>
                            <FiArrowLeft /> Back to Search
                        </button>
                        <div className={styles['dashboard-container']}>
                            <div className={styles['card-header']}>
                                <FiUploadCloud className={styles['card-icon']} />
                                <h3>Content Upload</h3>
                            </div>
                            <p className={styles['card-description']}>Your personal cloud storage is ready. Upload your files to begin.</p>
                            {selectedFile && selectedFile.length > 0 ? (
                                <div className={styles['files-list-upload']}>
                                    {Array.from(selectedFile).map((file, index) => (
                                        <div key={index} className={styles['file-item-upload']}>
                                            <FiFileText className={styles['file-icon-small']} />
                                            <div className={styles['file-details-upload']}>
                                                <span className={styles['file-name']}>{file.name}</span>
                                                <span className={styles['file-size']}>{formatFileSize(file.size)}</span>
                                            </div>
                                            <button onClick={() => removeFileFromList(file)} className={styles['remove-file-button']}>
                                                <FiX />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className={styles['file-dropzone']}>
                                    <div className={styles['file-dropzone-inner']}>
                                        <FiPaperclip className={styles['dropzone-icon']} />
                                        <span className={styles['dropzone-text']}>Click to select files</span>
                                        <span className={styles['dropzone-subtext']}>or drag and drop</span>
                                    </div>
                                    <input id="file-upload-input" type="file" onChange={handleFileChange} className={styles['file-input-hidden']} multiple />
                                </div>
                            )}
                            <button onClick={handleFileUpload} disabled={uploading || !selectedFile || selectedFile.length === 0} className={styles['dashboard-action-button']}>
                                {uploading ? 'Uploading...' : 'Upload Files'}
                            </button>
                            {uploadMessage && (
                                <p className={`${styles['status-message']} ${uploadMessage.includes('successfully') ? styles.success : styles.error}`}>
                                    {uploadMessage}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Dashboard;