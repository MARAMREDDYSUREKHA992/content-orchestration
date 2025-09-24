import os

# This logic exactly mirrors how your Flask app calculates the path
credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')

if not credentials_path:
    # __file__ gives the path of the current script (check_path.py)
    # os.path.dirname(__file__) gives the directory of the current script
    credentials_path = os.path.join(os.path.dirname(__file__), 'my-credentials.json')

print(f"--- PATH CHECK RESULT ---")
print(f"1. Script is running from: '{os.path.dirname(__file__)}'")
print(f"2. Constructed credentials path: '{credentials_path}'")

# Double-check if the file exists using the constructed path
if os.path.exists(credentials_path):
    print("\n** RESULT: The 'my-credentials.json' file EXISTS at the specified path! **")
    try:
        with open(credentials_path, 'r') as f:
            # Attempt to read a small part to confirm readability
            content_start = f.read(50)
            print(f"   (File seems readable. Starts with: '{content_start[:20]}...')")
    except Exception as e:
        print(f"   (WARNING: File exists but could not be read. Error: {e})")
else:
    print("\n** RESULT: The 'my-credentials.json' file DOES NOT EXIST at the specified path. **")
    print(f"   Expected full path: '{credentials_path}'")
    print(f"   Please ensure 'my-credentials.json' is directly inside the 'backend' folder.")
    print("   Also check for: ")
    print("   - Exact filename spelling (case-sensitive if not on Windows)")
    print("   - Hidden file extensions (e.g., 'my-credentials.json.txt')")
    print("   - Any extra spaces in the file name or folder names.")

print(f"-------------------------")