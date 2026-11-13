import os
import subprocess
import sys

def gen_skin_dance(skin, walk, dance, output):
    cmd = [
        "../skin_dance_video/render_skin_dance_video.mjs",
        "--skin", "../assets/"+skin+".png",
        *(["--walk"] if walk else []),
        *(["--dance", dance] if not walk else []),
        # dance 把空格替换为_，全部小写
        "--out", output,
        "--background", "transparent",
        "--format", "webm",
        "--cam-y", "10",
        "--width", "1024",
        "--height", "1024",
        "--duration", "10",
        "--yaw", "18",
        "--scale", "0.8"
    ]

    print("Running command:", " ".join(cmd))
    
    try:
        # Run the command and wait for it to complete
        # check=True raises CalledProcessError if the command exits with non-zero status
        subprocess.run(cmd, check=True)
        print("Success: Video built successfully!")
    except subprocess.CalledProcessError as e:
        print(f"Error: Command failed with exit code {e.returncode}", file=sys.stderr)
        sys.exit(e.returncode)
    except FileNotFoundError:
        print("Error: Could not find the executable script '../skin_dance_video/render_skin_dance_video.mjs'. Please make sure it is executable.", file=sys.stderr)
        sys.exit(1)
def main():
    # Ensure the script runs with the working directory set to its own directory,
    # so that relative paths like '../assets/...' resolve correctly.
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    gen_skin_dance("ironman", False, "Thriller Part 3", './assets/01_iron_man_dance.webm')
    gen_skin_dance("spiderman", False, "Thriller Part 4", './assets/02_spider_man_dance.webm')
    gen_skin_dance("thor", False, "Hip Hop Dancing", './assets/03_thor_dance.webm')
    gen_skin_dance("deadpool", False, "Twist Dance", './assets/04_deadpool_dance.webm')
    gen_skin_dance("dr_strange", False, "Hip Hop Dancing", './assets/05_doctor_strange_dance.webm')

if __name__ == "__main__":
    main()
