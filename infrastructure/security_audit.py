import subprocess
import os
import json
from datetime import datetime

# Configuration
TOOLS_DIR = os.path.join("infrastructure", "tools")
REPORTS_DIR = "reports"
TARGET_FE = "http://localhost:3000"
TARGET_BE = "http://localhost:8000"

# Tool Paths
KATANA = os.path.join(TOOLS_DIR, "katana.exe")
NUCLEI = os.path.join(TOOLS_DIR, "nuclei.exe")
HTTPX = os.path.join(TOOLS_DIR, "httpx.exe")

def run_command(cmd, shell=True):
    print(f"[*] Running: {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    try:
        result = subprocess.run(cmd, shell=shell, capture_output=True, text=True)
        return result.stdout
    except Exception as e:
        print(f"[!] Error running command: {e}")
        return ""

def main():
    if not os.path.exists(REPORTS_DIR):
        os.makedirs(REPORTS_DIR)

    report_content = f"# 🛡️ Lifesuck Elite Security Audit\n\nGenerated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"

    # 1. Bandit (SAST)
    print("\n[+] Phase 1: Static Analysis (Bandit)")
    bandit_cmd = f"python -m bandit -r backend/ --format json -o {os.path.join(REPORTS_DIR, 'bandit_report.json')}"
    run_command(bandit_cmd)
    report_content += "## 1. Static Analysis (Backend - Bandit)\n"
    report_content += "- Report saved to: `reports/bandit_report.json`\n"

    # 2. HTTPX (Header Security)
    print("\n[+] Phase 2: Header Security Probing (httpx)")
    httpx_cmd = f"{HTTPX} -u {TARGET_FE} -sc -server -method -v -title -o {os.path.join(REPORTS_DIR, 'httpx_fe.txt')}"
    run_command(httpx_cmd)
    report_content += "## 2. Header Security (Frontend/BFF - httpx)\n"
    report_content += "- Results saved to: `reports/httpx_fe.txt`\n"

    # 3. Katana (Recon / Crawling)
    print("\n[+] Phase 3: Application Crawling (Katana)")
    katana_cmd = f"{KATANA} -u {TARGET_FE} -o {os.path.join(REPORTS_DIR, 'katana_paths.txt')}"
    run_command(katana_cmd)
    report_content += "## 3. Application Surface (Katana)\n"
    report_content += "- Discovered endpoints saved to: `reports/katana_paths.txt`\n"

    # 4. Nuclei (Vulnerability Scanning)
    print("\n[+] Phase 4: Vulnerability Scanning (Nuclei)")
    nuclei_cmd = f"{NUCLEI} -u {TARGET_FE} -severity critical,high,medium -o {os.path.join(REPORTS_DIR, 'nuclei_findings.txt')}"
    run_command(nuclei_cmd)
    report_content += "## 4. Vulnerabilities Found (Nuclei)\n"
    report_content += "- Findings saved to: `reports/nuclei_findings.txt`\n"

    # Save Unified Summary
    main_report_path = os.path.join(REPORTS_DIR, "security_audit.md")
    with open(main_report_path, "w", encoding="utf-8") as f:
        f.write(report_content)

    print(f"\n[+] Audit Complete! Unified report: {main_report_path}")

if __name__ == "__main__":
    main()
