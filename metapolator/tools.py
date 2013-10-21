import os
import os.path as op
import re
import xmltomf
import model

from config import cFont, working_dir, buildfname
from model import putFont


def makefont(working_dir, fontpath):
    ufo2mf(fontpath)
    os.environ['MFINPUTS'] = op.join(working_dir, fontpath)
    writeGlyphlist(fontpath)
    strms = "cd %s; sh %s font.mf" % (working_dir, "makefont.sh")
    os.system(strms)


def fnextension(filename):
    try:
        basename, extension = filename.split('.')
    except:
        extension = "garbage"
        basename = ""
    return extension


def ufo2mf(fontpath):
    print "ufo2mf", fontpath
    dirnamef1 = working_dir(op.join(fontpath, cFont.fontna, "glyphs"))
    dirnamef2 = working_dir(op.join(fontpath, cFont.fontnb, "glyphs"))
    dirnamep1 = working_dir(op.join(fontpath, "glyphs"))
    if not op.exists(dirnamep1):
        os.makedirs(dirnamep1)

    charlist1 = filter(lambda f: fnextension(f) == 'glif', os.listdir(dirnamef1))
    charlist2 = filter(lambda f: fnextension(f) == 'glif', os.listdir(dirnamef2))

    for ch1 in charlist1:
        if ch1 in charlist2:
            fnb, ext = buildfname(ch1)
            if fnb == cFont.glyphunic or cFont.timestamp == 0 or cFont.mfoption == "1":
                newfile = fnb
                newfilename = newfile + ".mf"
                # commd2 = "python parser_pino_mono.py " +ch1 +" " +dirnamef1 +" " +dirnamef2 +" > " +dirnamep1 +"/" +newfilename
                # os.system(commd2)
                xmltomf.xmltomf1(ch1, dirnamef1, dirnamef2, dirnamep1, newfilename)

    cFont.timestamp = 1


def writeGlyphlist(fontpath):
    print "*** write glyphlist ***"
    ifile = open(working_dir(op.join(fontpath, "glyphlist.mf")), "w")
    dirnamep1 = working_dir(op.join(fontpath, "glyphs"))

    charlist1 = [f for f in os.listdir(dirnamep1)]

    for ch1 in charlist1:
        fnb, ext = buildfname(ch1)
        if ext in ["mf"]:
            ifile.write("input glyphs/"+ch1+"\n")
    ifile.close()


def putFontAllglyphs():
    #
    #  read all fonts (xml files with glif extension) in unix directory
    #  and put the xml data into db using the rule applied in loadoption
    #  only the fonts (xml file) will be read when the glifs are present in both fonts A and B
    #
    # save the values for restore
    idworks = cFont.idwork
    glyphnames = cFont.glyphName
    glyphunics = cFont.glyphunic

    dirnamea = op.join(working_dir(cFont.fontpath), cFont.fontna, "glyphs")
    if not op.exists(dirnamea):
        os.makedirs(dirnamea)

    dirnameb = op.join(working_dir(cFont.fontpath), cFont.fontnb, "glyphs")
    if not op.exists(dirnameb):
        os.makedirs(dirnameb)

    charlista = [f for f in os.listdir(dirnamea)]
    charlistb = [f for f in os.listdir(dirnameb)]
    for ch1 in charlista:
        if ch1 in charlistb:
            fnb, ext = buildfname(ch1)
            if ext in ["glif"]:
                glyphName = fnb
                cFont.glyphName = glyphName
                cFont.glyphunic = glyphName
                putFont()
    #
    #   save previous values back
    cFont.idwork = idworks
    cFont.glyphName = glyphnames
    cFont.glyphunic = glyphunics


def writeallxmlfromdb(alist):
    dirnamea = op.join(working_dir(cFont.fontpath), cFont.fontna, "glyphs")
    dirnameb = op.join(working_dir(cFont.fontpath), cFont.fontnb, "glyphs")

    charlista = [f for f in os.listdir(dirnamea) if fnextension(f) == 'glif']
    charlistb = [f for f in os.listdir(dirnameb) if fnextension(f) == 'glif']

    idworks = cFont.idwork
    aalist = []
    for g in alist:
        aalist.append(g.glyphname)
    #
    for ch1 in charlista:
        if ch1 in charlistb:
            glyphname, exte = buildfname(ch1)
            if glyphname in aalist:
                cFont.glyphunic = glyphname
                cFont.glyphName = glyphname
                #   for A and B font
                for iwork in ['0', '1']:
                    cFont.idwork = iwork
                    writexml()
    #
    #    restore old idwork value
    cFont.idwork = idworks


def get_json(content, glyphid=None):

    contour_pattern = re.compile(r'Filled\scontour\s:\n(.*?)..cycle', re.I | re.S | re.M)
    point_pattern = re.compile(r'\(((-?\d+.?\d+),(-?\d+.\d+))\)..controls\s\(((-?\d+.?\d+),(-?\d+.\d+))\)\sand\s\(((-?\d+.?\d+),(-?\d+.\d+))\)')

    pattern = re.findall(r'\[(\d+)\]\s+Edge structure(.*?)End edge', content,
                         re.I | re.DOTALL | re.M)
    edges = []
    for glyph, edge in pattern:
        if glyphid and int(glyphid) != int(glyph):
            continue
        contours = []
        for contour in contour_pattern.findall(edge.strip()):
            contour = re.sub('\n(\S)', '\\1', contour)
            _contours = []
            x_control_next_point, y_control_next_point = None, None
            for point in contour.split('\n'):
                point = point.strip().strip('..')
                match = point_pattern.match(point)
                if match:
                    x_point, y_point = match.group(1).split(',')
                    x_control_point, y_control_point = match.group(4).split(',')

                    controlpoints = [{'x': 0, 'y': 0},
                                     {'x': x_control_point, 'y': y_control_point}]
                    if x_control_next_point is not None and y_control_next_point is not None:
                        controlpoints[0] = {'x': x_control_next_point,
                                            'y': y_control_next_point}
                    _contours.append({'x': x_point, 'y': y_point,
                                      'controls': controlpoints})
                    x_control_next_point, y_control_next_point = match.group(7).split(',')

            if x_control_next_point and y_control_next_point:
                _contours[0]['controls'][0] = {'x': x_control_next_point,
                                               'y': y_control_next_point}

            contours.append(_contours)
        edges.append({'glyph': glyph, 'contours': contours})

    return {'total_edges': len(edges), 'edges': edges}
