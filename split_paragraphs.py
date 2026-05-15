import os
import glob
import re

def reformat_transcript(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read().strip()
        
    if not content:
        return
        
    # If the file already has multiple paragraphs (double newlines), skip it
    if '\n\n' in content:
        return
        
    # Replace single newlines with space to make it a continuous block first
    content = content.replace('\n', ' ')
    
    # Split into sentences using a simple regex
    # Match sentence endings (., !, ?) followed by space and a capital letter or end of string
    sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z0-9"\'])', content)
    
    # Re-group sentences into paragraphs (e.g., 4 sentences per paragraph)
    paragraphs = []
    current_para = []
    
    for i, sentence in enumerate(sentences):
        current_para.append(sentence)
        if len(current_para) >= 4:
            paragraphs.append(" ".join(current_para))
            current_para = []
            
    if current_para:
        paragraphs.append(" ".join(current_para))
        
    new_content = "\n\n".join(paragraphs)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

if __name__ == "__main__":
    search_pattern = os.path.join("public", "generated_resources", "**", "podcasts", "**", "*.txt")
    files = glob.glob(search_pattern, recursive=True)
    
    count = 0
    for file in files:
        reformat_transcript(file)
        count += 1
        
    print(f"Processed {count} files.")
