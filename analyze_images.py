import os
import json
import re
from PIL import Image

ROOT_DIR = r"d:\Gitrepos\sdpics"

def get_comfy_summary(prompt_json):
    summary = {
        "type": "ComfyUI",
        "checkpoints": [],
        "loras": [],
        "prompts": [],
        "negative_prompts": [], # Comfy usually mixes them in prompts list based on node connections, hard to distinguish without traversing links, but we can try basic heuristics if needed. For now just dumping all text nodes.
        "sampler": {},
        "image_size": []
    }
    
    try:
        data = json.loads(prompt_json)
    except:
        return summary

    for node_id, node in data.items():
        class_type = node.get("class_type", "")
        inputs = node.get("inputs", {})
        
        # Checkpoints
        if "CheckpointLoader" in class_type or "Load Checkpoint" in class_type:
            ckpt = inputs.get("ckpt_name") or inputs.get("chkpt_name")
            if ckpt: summary["checkpoints"].append(ckpt)
            
        # LoRAs
        if "LoraLoader" in class_type:
            lora = inputs.get("lora_name")
            if lora: summary["loras"].append(lora)
            
        # Prompts (CLIP Text Encode)
        if "CLIPTextEncode" in class_type or "Prompt" in class_type:
            text = inputs.get("text") or inputs.get("text_g") or inputs.get("text_l")
            if text and isinstance(text, str) and len(text) > 0:
                # Basic heuristic: if it contains "worst quality" or "bad anatomy", it might be negative
                if "worst quality" in text or "bad anatomy" in text or "nsfw" in text.lower():
                     summary["negative_prompts"].append(text.strip())
                else:
                     summary["prompts"].append(text.strip())

        # Sampler
        if "KSampler" in class_type:
            summary["sampler"]["seed"] = inputs.get("seed")
            summary["sampler"]["steps"] = inputs.get("steps")
            summary["sampler"]["cfg"] = inputs.get("cfg")
            summary["sampler"]["sampler_name"] = inputs.get("sampler_name")
            summary["sampler"]["scheduler"] = inputs.get("scheduler")

        # Image Size
        if "EmptyLatentImage" in class_type:
             w = inputs.get("width")
             h = inputs.get("height")
             if w and h:
                 summary["image_size"].append(f"{w}x{h}")
    
    return summary

def parse_sd_parameters(params_text):
    summary = {
        "type": "SD WebUI",
        "prompts": [],
        "negative_prompts": [],
        "sampler": {},
        "checkpoints": [],
        "loras": [],
        "image_size": []
    }

    # Split into Positive, Negative, and Settings
    # Standard format: 
    # Positive Prompt
    # Negative prompt: Negative Prompt
    # Steps: 20, Sampler: Euler a, ...
    
    parts = params_text.split("Negative prompt:")
    positive = parts[0].strip()
    if positive:
        summary["prompts"].append(positive)
    
    remainder = ""
    if len(parts) > 1:
        remainder = parts[1]
    else:
        # Check if no negative prompt but has settings
        if "Steps:" in parts[0]:
             # This is a bit tricky, usually Negative prompt is present if empty.
             # If strictly no negative prompt:
             p_parts = parts[0].split("\nSteps:")
             summary["prompts"] = [p_parts[0].strip()]
             if len(p_parts) > 1:
                 remainder = "Steps:" + p_parts[1]
    
    negative = ""
    settings = ""
    
    if remainder:
        # Look for the start of settings (Steps: ...)
        # It's usually on a new line, but not always reliable if prompt has "Steps: " inside it.
        # Strict pattern matching for settings line
        settings_match = re.search(r"\nSteps: \d+,", remainder)
        if settings_match:
            negative = remainder[:settings_match.start()].strip()
            settings = remainder[settings_match.start():].strip()
        else:
            negative = remainder.strip()
            
    if negative:
        summary["negative_prompts"].append(negative)
        
    if settings:
        # Parse settings
        # Example: Steps: 30, Sampler: Euler a, Schedule type: Automatic, CFG scale: 6, Seed: 1749255975, Size: 960x1728, Model hash: b62c3e1fb9, Model: oneObsession_15Noobai
        
        # Extract basic info using regex or simple split
        pairs = [s.strip() for s in settings.split(",")]
        for p in pairs:
            if ":" in p:
                k, v = p.split(":", 1)
                k = k.strip()
                v = v.strip()
                
                if k == "Steps": summary["sampler"]["steps"] = v
                if k == "Sampler": summary["sampler"]["sampler_name"] = v
                if k == "CFG scale": summary["sampler"]["cfg"] = v
                if k == "Seed": summary["sampler"]["seed"] = v
                if k == "Size": summary["image_size"].append(v)
                if k == "Model": summary["checkpoints"].append(v)
                if k == "Lora hashes": 
                    # Sometimes lora hashes are listed
                    pass
    
    # Extract LoRA from prompt text (e.g. <lora:name:1.0>)
    lora_pattern = r"<lora:([^:>]+)(?::[^>]+)?>"
    loras = re.findall(lora_pattern, positive)
    if loras:
        summary["loras"].extend(loras)
        
    return summary

def analyze_all():
    image_files = []
    for root, dirs, files in os.walk(ROOT_DIR):
        for file in files:
            if file.lower().endswith(".png"):
                image_files.append(os.path.join(root, file))
    
    print(f"Found {len(image_files)} images in {ROOT_DIR}\n")
    
    for filepath in image_files:
        filename = os.path.basename(filepath)
        # Check if file exists (in case of race conditions, though unlikely here)
        if not os.path.exists(filepath): continue
        
        try:
            with Image.open(filepath) as img:
                info = img.info or {}
                
                summary = None
                
                # Check for ComfyUI
                if "prompt" in info:
                    summary = get_comfy_summary(info["prompt"])
                # Check for SD WebUI
                elif "parameters" in info:
                    summary = parse_sd_parameters(info["parameters"])
                
                if summary:
                    print(f"=== {filename} ({summary['type']}) ===")
                    print(f"Path: {os.path.relpath(filepath, ROOT_DIR)}")
                    
                    if summary["checkpoints"]:
                        print(f"Checkpoints: {', '.join(summary['checkpoints'])}")
                    if summary["loras"]:
                        print(f"LoRAs: {', '.join(summary['loras'])}")
                    if summary["sampler"]:
                        s = summary["sampler"]
                        # Format nicely
                        out = []
                        if "sampler_name" in s: out.append(f"Sampler: {s['sampler_name']}")
                        if "steps" in s: out.append(f"Steps: {s['steps']}")
                        if "cfg" in s: out.append(f"CFG: {s['cfg']}")
                        if "seed" in s: out.append(f"Seed: {s['seed']}")
                        print(f"Settings: {', '.join(out)}")
                        
                    if summary["image_size"]:
                        print(f"Size: {', '.join(summary['image_size'])}")
                        
                    if summary["prompts"]:
                        print("--- Positive Prompt ---")
                        for p in summary["prompts"]:
                            print(p[:200] + "..." if len(p) > 200 else p)
                            
                    if summary["negative_prompts"]:
                        print("--- Negative Prompt ---")
                        for p in summary["negative_prompts"]:
                            print(p[:200] + "..." if len(p) > 200 else p)
                    
                    print("\n")
                else:
                    # Skip printing files with no generation metadata to reduce noise
                    # or print a one-liner
                    # print(f"=== {filename} ===\nNo generation metadata found.\n")
                    pass
                    
        except Exception as e:
            print(f"Error reading {filename}: {e}\n")

if __name__ == "__main__":
    analyze_all()
