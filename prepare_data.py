import json
import csv
import math
import os

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(base_dir)
    data_dir = os.path.join(base_dir, 'data')
    os.makedirs(data_dir, exist_ok=True)

    print("Loading constellation names...")
    with open(os.path.join(parent_dir, 'constellations.json'), 'r', encoding='utf-8') as f:
        names_data = json.load(f)

    const_meta = {}
    for feat in names_data['features']:
        cid = feat['id']
        props = feat['properties']
        const_meta[cid] = {
            'id': cid,
            'name': props.get('name', cid),
            'english': props.get('en', props.get('name', cid)),
            'genitive': props.get('gen', ''),
            'description': props.get('desc', '')
        }

    # Constellation lore / descriptions dictionary for added flavor
    LORE = {
        "And": "The Chained Maiden, home to the Andromeda Galaxy (M31).",
        "Ant": "The Air Pump, invented by Nicolas-Louis de Lacaille in the 18th century.",
        "Aps": "The Bird of Paradise, representing an exotic tropical bird.",
        "Aql": "The Eagle that carried Zeus's thunderbolts in Greek mythology.",
        "Aqr": "The Water Bearer, one of the oldest recognized constellations.",
        "Ara": "The Altar where the Olympian gods made offerings before battling the Titans.",
        "Ari": "The Ram whose Golden Fleece became the quest of Jason and the Argonauts.",
        "Aur": "The Charioteer, containing the bright golden star Capella.",
        "Boo": "The Herdsman or Bear Driver, following the Great Bear around the pole.",
        "Cae": "The Chisel, introduced by Lacaille to represent an engraver's tool.",
        "Cam": "The Giraffe, a faint northern constellation introduced in 1612.",
        "Cnc": "The Crab that pinched Heracles during his fight with the Hydra.",
        "CVn": "The Hunting Dogs Asterion and Chara, held on a leash by Bootes.",
        "CMa": "The Greater Dog, faithful hound of Orion, containing Sirius the Dog Star.",
        "CMi": "The Lesser Dog, containing the brilliant star Procyon.",
        "Cap": "The Sea Goat, a mythological hybrid creature of goat and fish.",
        "Car": "The Keel of the legendary ship Argo Navis that sailed for the Golden Fleece.",
        "Cas": "The Queen of Ethiopia, vanity-cursed to circle the celestial pole forever.",
        "Cen": "The Centaur, representing Chiron the wisest and most just of centaurs.",
        "Cep": "The King of Ethiopia, husband of Cassiopeia and father of Andromeda.",
        "Cet": "The Sea Monster sent by Poseidon to ravage the Ethiopian coast.",
        "Cha": "The Chameleon, navigating the faint southern skies.",
        "Cir": "The Compasses, representing drafting dividers.",
        "Col": "Noah's Dove, introduced by Petrus Plancius in the late 16th century.",
        "Com": "Berenice's Hair, dedicated to Queen Berenice II of Egypt.",
        "CrA": "The Southern Crown, a wreath worn by Sagittarius or Centaurus.",
        "CrB": "The Northern Crown, the jeweled crown of Ariadne given by Dionysus.",
        "Crv": "The Crow or Raven sent by Apollo to fetch water.",
        "Crt": "The Cup of Apollo, placed beside the celestial Raven.",
        "Cru": "The Southern Cross, the most famous navigational landmark of the Southern Hemisphere.",
        "Cyg": "The Swan flying down the Milky Way, containing the Northern Cross.",
        "Del": "The Dolphin that carried the Greek poet Arion safely ashore.",
        "Dor": "The Dolphinfish (Mahi-mahi) or Swordfish of the southern sky.",
        "Dra": "The Dragon Ladon guarding the golden apples in the Garden of the Hesperides.",
        "Equ": "The Little Horse, associated with Celeris, foal of Pegasus.",
        "Eri": "The celestial River Eridanus where Phaethon fell in myth.",
        "For": "The Chemical Furnace, honoring Antoine Lavoisier's laboratory.",
        "Gem": "The Gemini Twins, Castor and Pollux, immortalized side by side.",
        "Gru": "The Crane, introduced by Dutch navigators Keyser and de Houtman.",
        "Her": "Heracles the legendary hero kneeling after completing his twelve labors.",
        "Hor": "The Pendulum Clock, commemorating Christiaan Huygens's invention.",
        "Hya": "The Water Monster Hydra, the largest of all 88 modern constellations.",
        "Hyi": "The Lesser Water Snake of the deep southern polar sky.",
        "Ind": "The Indian, depicting an indigenous inhabitant of the Americas or Indies.",
        "Lac": "The Lizard, introduced by Johannes Hevelius in 1687.",
        "Leo": "The Nemean Lion slain by Heracles in his first labor.",
        "LMi": "The Lesser Lion, introduced by Hevelius between Leo and Ursa Major.",
        "Lep": "The Hare crouching at the feet of Orion the hunter.",
        "Lib": "The Scales of Justice held by Astraea (Virgo).",
        "Lup": "The Wolf impaled on the spear of the Centaur.",
        "Lyn": "The Lynx, named because only a lynx-eyed observer could spot its faint stars.",
        "Lyr": "The Lyre of Orpheus, whose music could charm beasts and trees.",
        "Men": "Table Mountain at Cape Town, South Africa, honored by Lacaille.",
        "Mic": "The Microscope, celebrating scientific instruments of the Enlightenment.",
        "Mon": "The Unicorn, galloping silently through the winter Milky Way.",
        "Mus": "The Fly, hovering near the Southern Cross.",
        "Nor": "The Carpenter's Level and Square.",
        "Oct": "The Octant, containing the South Celestial Pole.",
        "Oph": "The Serpent Bearer, Asclepius the mythical founder of medicine.",
        "Ori": "Orion the mighty Hunter, one of the most magnificent constellations in the heavens.",
        "Pav": "The Peacock, sacred bird of Hera in Greek myth.",
        "Peg": "Pegasus the Winged Divine Stallion born from the neck of Medusa.",
        "Per": "Perseus the slayer of Medusa and rescuer of Andromeda.",
        "Phe": "The mythical Phoenix rising reborn from its own ashes.",
        "Pic": "The Painter's Easel, another instrument of the arts celebrated by Lacaille.",
        "Psc": "The Two Fishes tied together by a ribbon, representing Aphrodite and Eros.",
        "PsA": "The Southern Fish drinking the water poured by Aquarius.",
        "Pup": "The Poop Deck or Stern of the legendary ship Argo Navis.",
        "Pyx": "The Mariner's Magnetic Compass on board Argo Navis.",
        "Ret": "The Reticle, the crosshairs in an astronomical telescope.",
        "Sge": "The celestial Arrow shot by Heracles or Apollo.",
        "Sgr": "The Archer Centaur aiming his bow at the heart of the Scorpion.",
        "Sco": "The Scorpion whose venomous sting brought down Orion.",
        "Scl": "The Sculptor's Studio, containing the South Galactic Pole.",
        "Sct": "The Shield of Sobieski, celebrating Polish King John III Sobieski.",
        "Ser": "The Serpent held in two halves (Caput and Cauda) by Ophiuchus.",
        "Sex": "The Astronomical Sextant used by Johannes Hevelius.",
        "Tau": "The Bull containing the Pleiades and Hyades star clusters.",
        "Tel": "The Refracting Telescope invented in the 17th century.",
        "Tri": "The Northern Triangle, an ancient geometric constellation.",
        "TrA": "The Southern Triangle, mapped by early European explorers.",
        "Tuc": "The Toucan, home to the Small Magellanic Cloud.",
        "UMa": "The Great Bear containing the famous Big Dipper / Plough asterism.",
        "UMi": "The Little Bear containing Polaris the North Star.",
        "Vel": "The Sails of the legendary ship Argo Navis.",
        "Vir": "The Maiden of Justice (Astraea or Demeter) carrying an ear of wheat.",
        "Vol": "The Flying Fish, skimming above the southern waters.",
        "Vul": "The Fox carrying a goose in its jaws, introduced by Hevelius."
    }

    print("Loading HYG dataset...")
    hyg_path = os.path.join(parent_dir, 'hyg_v42.csv')
    stars = []
    
    with open(hyg_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for r in reader:
            try:
                mag = float(r['mag']) if r['mag'] else 99.0
                if mag < 6.8: # Visible naked eye
                    ra = float(r['ra'])
                    dec = float(r['dec'])
                    ra_deg = ra * 15.0
                    if ra_deg > 180: ra_deg -= 360
                    dec_deg = dec
                    
                    x = float(r['x'])
                    y = float(r['y'])
                    z = float(r['z'])
                    dist = float(r['dist']) if (r['dist'] and float(r['dist']) > 0) else 100.0

                    stars.append({
                        'id': int(r['id']),
                        'hip': int(r['hip']) if r['hip'] else None,
                        'name': r['proper'].strip(),
                        'bayer': r['bayer'].strip(),
                        'flam': r['flam'].strip(),
                        'con': r['con'].strip(),
                        'mag': mag,
                        'ci': float(r['ci']) if r['ci'] else 0.6,
                        'dist': dist,
                        'x': x,
                        'y': y,
                        'z': z,
                        'ra_deg': ra_deg,
                        'dec_deg': dec_deg
                    })
            except Exception:
                continue

    print(f"Loaded {len(stars)} naked-eye stars (mag < 6.8).")

    # Load constellation line features
    with open(os.path.join(parent_dir, 'constellations.lines.json'), 'r', encoding='utf-8') as f:
        lines_data = json.load(f)

    # Function to find closest star to a coordinate (ra_deg, dec_deg)
    def find_closest_star(ra_p, dec_p, preferred_con=None):
        best_star = None
        min_dist = 9999.0
        
        # Check preferred constellation stars first
        if preferred_con:
            for s in stars:
                if s['con'] == preferred_con:
                    d = math.hypot(s['ra_deg'] - ra_p, s['dec_deg'] - dec_p)
                    if d < min_dist:
                        min_dist = d
                        best_star = s
            if min_dist < 1.0: # Good match within 1 degree
                return best_star
        
        # Fallback to all stars
        for s in stars:
            d = math.hypot(s['ra_deg'] - ra_p, s['dec_deg'] - dec_p)
            if d < min_dist:
                min_dist = d
                best_star = s
        return best_star

    constellations_dict = {}

    for feat in lines_data['features']:
        cid = feat['id']
        geom = feat['geometry']
        coords = geom['coordinates']
        
        c_lines = []
        c_stars_map = {}

        for line in coords:
            for i in range(len(line) - 1):
                p1 = line[i]
                p2 = line[i+1]
                s1 = find_closest_star(p1[0], p1[1], cid)
                s2 = find_closest_star(p2[0], p2[1], cid)
                
                if s1 and s2 and s1['id'] != s2['id']:
                    c_lines.append({
                        's1_id': s1['id'],
                        's2_id': s2['id'],
                        'p1': [round(s1['x'], 3), round(s1['y'], 3), round(s1['z'], 3)],
                        'p2': [round(s2['x'], 3), round(s2['y'], 3), round(s2['z'], 3)]
                    })
                    c_stars_map[s1['id']] = s1
                    c_stars_map[s2['id']] = s2

        if not c_lines:
            continue

        c_stars_list = list(c_stars_map.values())
        
        # Compute center direction vector from Earth (unit vector)
        # Average the unit direction vectors of all stars in the constellation
        sum_dx = sum(s['x'] / s['dist'] for s in c_stars_list)
        sum_dy = sum(s['y'] / s['dist'] for s in c_stars_list)
        sum_dz = sum(s['z'] / s['dist'] for s in c_stars_list)
        norm = math.sqrt(sum_dx**2 + sum_dy**2 + sum_dz**2) or 1.0
        direction = [round(sum_dx / norm, 4), round(sum_dy / norm, 4), round(sum_dz / norm, 4)]

        # Find brightest star in the constellation
        brightest = min(c_stars_list, key=lambda s: s['mag'])
        brightest_display = brightest['name'] or (brightest['bayer'] + ' ' + cid if brightest['bayer'] else f"HIP {brightest['hip']}")

        dists = [s['dist'] for s in c_stars_list]

        meta = const_meta.get(cid, {})
        name = meta.get('name', cid)
        english = meta.get('english', name)
        lore = LORE.get(cid, f"A constellation in the celestial sphere representing {english}.")

        # Load art mapping if available
        art_info = None
        art_map_path = os.path.join(data_dir, 'constellation_art_mapping.json')
        if os.path.exists(art_map_path):
            try:
                with open(art_map_path, 'r', encoding='utf-8') as af:
                    m_data = json.load(af)
                    if cid in m_data:
                        item = m_data[cid]
                        art_info = {
                            'filename': item.get('artFile'),
                            'url': item.get('artUrl'),
                            'note': item.get('historicalNote'),
                            'width': item.get('imageInfo', {}).get('width'),
                            'height': item.get('imageInfo', {}).get('height')
                        }
            except Exception:
                pass

        const_entry = {
            'id': cid,
            'name': name,
            'english': english,
            'lore': lore,
            'direction': direction,
            'brightestStar': {
                'name': brightest_display,
                'mag': round(brightest['mag'], 2),
                'dist': round(brightest['dist'], 1)
            },
            'distMin': round(min(dists), 1),
            'distMax': round(max(dists), 1),
            'starCount': len(c_stars_list),
            'lines': c_lines,
            'stars': [{
                'id': s['id'],
                'hip': s['hip'],
                'name': s['name'] or (s['bayer'] + ' ' + cid if s['bayer'] else ''),
                'mag': round(s['mag'], 2),
                'ci': s['ci'],
                'dist': round(s['dist'], 1),
                'x': round(s['x'], 3),
                'y': round(s['y'], 3),
                'z': round(s['z'], 3)
            } for s in c_stars_list]
        }
        if art_info:
            const_entry['art'] = art_info

        constellations_dict[cid] = const_entry

    print(f"Generated {len(constellations_dict)} constellations with complete 3D lines and star data.")

    # Write constellations_data.json
    out_const_path = os.path.join(data_dir, 'constellations.json')
    with open(out_const_path, 'w', encoding='utf-8') as f:
        json.dump(constellations_dict, f, separators=(',', ':'))
    print(f"Saved constellations data to {out_const_path} ({os.path.getsize(out_const_path) / 1024:.1f} KB)")

    # Also mirror to public/data for web serving
    pub_data_dir = os.path.join(base_dir, 'public', 'data')
    os.makedirs(pub_data_dir, exist_ok=True)
    pub_const_path = os.path.join(pub_data_dir, 'constellations.json')
    with open(pub_const_path, 'w', encoding='utf-8') as f:
        json.dump(constellations_dict, f, separators=(',', ':'))
    print(f"Saved constellations data to public {pub_const_path}")

    # Prepare compact starfield for background rendering
    # Pack: [x, y, z, mag, ci] as flat array
    starfield_packed = []
    for s in stars:
        # Scale parsec coords to avoid extreme floating point spread for far stars in background
        starfield_packed.extend([
            round(s['x'], 2),
            round(s['y'], 2),
            round(s['z'], 2),
            round(s['mag'], 2),
            round(s['ci'], 2)
        ])

    out_stars_path = os.path.join(data_dir, 'stars.json')
    with open(out_stars_path, 'w', encoding='utf-8') as f:
        json.dump(starfield_packed, f, separators=(',', ':'))
    print(f"Saved background stars to {out_stars_path} ({os.path.getsize(out_stars_path) / 1024:.1f} KB)")

if __name__ == '__main__':
    main()
