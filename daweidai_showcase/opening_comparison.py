"""Composite the opening real-photo comparison and animate the figure home."""


def settings(edit, shot, variant):
    config = shot["comparison"]
    target = edit["formats"][variant]
    layout = config[variant]
    assert 0 <= config["fadeStart"] < config["fadeStart"] + config["fadeDuration"] <= shot["duration"]
    assert 0 <= config["moveStart"] < config["moveEnd"] <= shot["duration"]
    assert 0 <= layout["shiftX"] < target["width"] / 2
    assert layout["photoWidth"] > 0 and layout["photoWidth"] % 2 == 0
    assert 0 <= layout["photoX"] < target["width"] - layout["photoWidth"]
    assert 0 <= layout["photoY"] < target["height"]
    return config, layout


def filter_graph(edit, shot, variant, crop):
    config, layout = settings(edit, shot, variant)
    width, height = (edit["formats"][variant][key] for key in ("width", "height"))
    progress = f"clip((t-{config['moveStart']})/{config['moveEnd']-config['moveStart']},0,1)"
    ease = f"({progress})*({progress})*(3-2*({progress}))"
    if variant == "portrait":
        # The uncropped source has enough horizontal room for this movement.
        # Pan inside that source, keeping natural image detail at both edges.
        shift = layout["shiftX"] * crop["width"] / width
        assert crop["x"][0][1] >= shift, "Opening pan leaves the source image"
        x = f"{crop['x'][0][1]}-{shift}*(1-({ease}))"
        primary = (f"[0:v]crop={crop['width']}:{crop['height']}:x='{x}':y={crop['y']},"
                   f"scale={width}:{height}:flags=lanczos,setsar=1,format=rgb24[figure];")
    else:
        # The wide crop uses all of the source's width. Continue the neutral
        # left edge only for the short camera move, then return to the crop.
        shift = layout["shiftX"]
        primary = (
            f"[0:v]crop={crop['width']}:{crop['height']}:{crop['x'][0][1]}:{crop['y']},"
            f"scale={width}:{height}:flags=lanczos,setsar=1,format=gbrp,"
            f"pad={width+shift}:{height}:{shift}:0,fillborders=left={shift}:mode=smear,"
            f"crop={width}:{height}:x='{shift}*({ease})':y=0,format=rgb24[figure];"
        )
    return (
        primary +
        f"[1:v]scale={layout['photoWidth']}:-2:flags=lanczos,setsar=1,format=rgba,"
        f"fade=t=out:st={config['fadeStart']}:d={config['fadeDuration']}:alpha=1[real];"
        f"[figure][real]overlay=x={layout['photoX']}:y={layout['photoY']}:format=rgb:shortest=1,"
        f"scale={width}:{height}:flags=lanczos:in_range=pc:out_range=tv:out_color_matrix=bt709,"
        "format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709[picture]"
    )
