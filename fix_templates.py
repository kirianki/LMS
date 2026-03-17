import os

statement_path = 'backend/apps/loans/templates/default_loan_statement.html'
letter_path = 'backend/apps/loans/templates/default_disbursement_letter.html'

def fix_file(path):
    with open(path, 'r') as f:
        content = f.read()
    
    # Fix the mangled pattern
    # It looks like:
    # background-color: {
    #                     {
    #                     primary_color
    #                 }
    #             }
    # 
    #             ;
    
    import re
    
    # Target pattern for background-color
    pattern1 = r'background-color:\s*{\s*\n\s*{\s*\n\s*primary_color\s*\n\s*}\s*\n\s*}\s*\n\s*;'
    content = re.sub(pattern1, 'background-color: {{ primary_color }};', content)
    
    # Target pattern for border-bottom
    pattern2 = r'border-bottom:\s*2pt solid\s*{\s*\n\s*{\s*\n\s*primary_color\s*\n\s*}\s*\n\s*}\s*\n\s*;'
    content = re.sub(pattern2, 'border-bottom: 2pt solid {{ primary_color }};', content)
    
    # Target pattern for color
    pattern3 = r'color:\s*{\s*\n\s*{\s*\n\s*primary_color\s*\n\s*}\s*\n\s*}\s*\n\s*;'
    content = re.sub(pattern3, 'color: {{ primary_color }};', content)

    # Specific fix for line 336 in loan statement
    pattern4 = r'style="color: {{ primary_color }}; margin: 0; font-size: 16pt; text-transform: uppercase;">{{\s*\n\s*company_name }}</h1>'
    content = re.sub(pattern4, 'style="color: {{ primary_color }}; margin: 0; font-size: 16pt; text-transform: uppercase;">{{ company_name }}</h1>', content)

    with open(path, 'w') as f:
        f.write(content)

if os.path.exists(statement_path):
    fix_file(statement_path)
    print(f"Fixed {statement_path}")

if os.path.exists(letter_path):
    fix_file(letter_path)
    print(f"Fixed {letter_path}")
