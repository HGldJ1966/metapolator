app.filter('mastersInEditFilter', function() {
    return function(sequences) {
        var filtered;
        angular.forEach(sequences, function(sequence) {
            angular.forEach(sequence.masters, function(master) {
                if (master.edit[0]) {
                    filtered = master.parameters;
                }
            });
        });
        return filtered;
    };
});

app.filter('glyphsInEditFilter', function() {
    return function(sequences, theParameters, theOperators) {
        var selectedGlyphs = [];
        // check which glyphs are in edit
        angular.forEach(sequences, function(sequence) {
            angular.forEach(sequence.masters, function(master) {
                if (master.edit[0]) {
                    angular.forEach(master.children, function(glyph) {
                        if (glyph.edit) {
                            selectedGlyphs.push({
                                parameters : glyph.parameters,
                                glyph : glyph,
                                master : master,
                                sequence : sequence
                            });
                        }
                    });
                }
            });
        });

        // compare the standard parameters and operators (the_) with parameters in selected glyphs
        var parameterArray = [];
        angular.forEach(theParameters, function(theParameter) {
            var theOperations = [];
            var hasThisParameter = false;
            angular.forEach(theOperators, function(theOperator) {
                var hasThisOperator = false;
                var lowest = null;
                var highest = null;
                // look inside glyphs
                angular.forEach(selectedGlyphs, function(glyph) {
                    angular.forEach(glyph.parameters, function(glyphParameter) {
                        if (glyphParameter.name == theParameter) {
                            hasThisParameter = true;
                            angular.forEach(glyphParameter.operations, function(operation) {
                                if (operation.operator == theOperator) {
                                    hasThisOperator = true;
                                    if (operation.value < lowest || lowest == null) {
                                        lowest = operation.value;
                                    }
                                    if (operation.value > highest || highest == null) {
                                        highest = operation.value;
                                    }
                                }
                            });
                        }
                    });
                });
                var range = true;
                if (lowest == highest) {
                    range = false;
                }
                if (hasThisOperator) {
                    theOperations.push({
                        operator : theOperator,
                        range : range,
                        low : lowest,
                        high : highest
                    });
                }
            });
            if (hasThisParameter) {
                parameterArray.push({
                    name : theParameter,
                    operations : theOperations
                });
            }
        });
        return parameterArray;
    };
});

app.filter('rangeFilter', function() {
    return function(specimen, filter) {
        var filtered = [];
        for (var i = 0; i < specimen.length; i++) {
            var thisGlyph = specimen[i];
            if (filter.length == 0) {
                filtered.push(thisGlyph);
            } else {
                if (filter.indexOf(thisGlyph.name) > -1) {
                    filtered.push(thisGlyph);
                }
            }
        }
        return filtered;
    };
});

app.filter('specimenFilter', function() {
    return function(specimen, options, sequences, families, specimenPanel, currentInstance, fontMapping) {
        if (specimen.name != "Glyph Range" && fontMapping) {
            //console.log("start filtering:" + new Date().getTime());
           
            
            function isSpaceGlyph(glyph) {
                if (glyph == "space" || glyph == "*n" || glyph == "*p") {
                    return true;
                } else {
                    return false;
                }
            }

            function substitute(glyph) {
                // check if glyph is a-z A-Z
                if (/^[a-zA-Z]*$/.test(glyph)) {
                    return -1;
                } else {
                    // we should add var pos = -2. So -1 is regular alphabetic, -2 is unknown
                    var pos = -1;
                    var preUnicode = glyph.charCodeAt(0).toString(16).toUpperCase();
                    var n = 4 - preUnicode.length;
                    var pre = "";
                    for (var q = 0; q < n; q++) {
                        pre += "0";
                    }
                    var unicode = pre + preUnicode;
                    for ( i = 0; i < fontMapping.length; i++) {
                        if (unicode == fontMapping[i].unicode) {
                            pos = i;
                            break;
                        }
                    }  
                    return pos;
                }
            }

            function stringToGlyphs(string, unique, includeSpaces) {
                var glyphs = [];
                for (var i = 0; i < string.length; i++) {
                    var glyph = string[i];
                    var substitutePosition = substitute(glyph);
                    // detecting space, linebreak or paragraph
                    if (glyph == "*" && (string[i + 1] == "n" || string[i + 1] == "p")) {
                        glyph = "*" + string[i + 1];
                        i++;
                    } else if (glyph == "<") {
                        // detecting foreign glyph
                        glyph = "";
                        var foundEnd = false;
                        for (var q = 1; q < 10; q++) {
                            if (!foundEnd) {
                                if (string[i + q] != ">") {
                                    glyph += string[i + q];
                                } else {
                                    var foundEnd = true;
                                }
                            }
                        }
                        if (!foundEnd) {
                            // just a normal "<"
                            glyph = "<";
                        } else {
                            i = i + glyph.length + 1;
                        }
                    } else if (substitutePosition > -1) {
                        glyph = fontMapping[substitutePosition].glyphName;
                    }
                    if (unique) {
                        // unique is set for the filter
                        if (glyphs.indexOf(glyph) < 0 || glyph == "*n" || glyph == "*p") {
                            if(glyph != "space" || includeSpaces) {
                                glyphs.push(glyph);
                            }
                        }
                    } else {
                        if (glyph != "space" || includeSpaces) {
                            glyphs.push(glyph);
                        }
                    }
                }
                return glyphs;
            }

            var specimenText = stringToGlyphs(specimen.text, false, true);
            if (options.filter.length == 0) {
                newText = specimenText;
            } else {
                var newText = [];
                var pushedFilterGlyph = 0;

                if (options.strict == 1) {
                    var filterText = stringToGlyphs(options.filter, false, true);
                    var insertionInterval = Math.sqrt(2 * specimenText.length / filterText.length);
                    var insertionCounter = 0.5;
                    for ( i = 0; i < specimenText.length; i++) {
                        newText.push(specimenText[i]);
                        var thisPosition = Math.floor(insertionCounter * insertionInterval);
                        if (thisPosition == i) {
                            newText.push(filterText[pushedFilterGlyph]);
                            pushedFilterGlyph++;
                            if (pushedFilterGlyph == filterText.length) {
                                pushedFilterGlyph = 0;
                            }
                            insertionCounter++;
                        }
                    }
                } else if (options.strict == 2) {
                    var filterText = stringToGlyphs(options.filter, false, true);
                    var withoutSpaces_i = 0;
                    var insertionCounter = 1;
                    for ( i = 0; i < specimenText.length; i++) {
                        if (!isSpaceGlyph(specimenText[i])) {
                            if (withoutSpaces_i == insertionCounter) {
                                newText.push(filterText[pushedFilterGlyph]);
                                insertionCounter += 2;
                                pushedFilterGlyph++;
                                if (pushedFilterGlyph == filterText.length) {
                                    pushedFilterGlyph = 0;
                                }
                            } else {
                                newText.push(specimenText[i]);
                            }
                            withoutSpaces_i++;
                        } else {
                            newText.push(specimenText[i]);
                        }
                    }
                } else if (options.strict == 3) {
                    var filterText = stringToGlyphs(options.filter, true, false);
                    if (filterText.length == 1) {
                        newText.push(filterText[0]);
                    } else {
                        for ( i = 0; i < filterText.length; i++) {
                            for ( j = i; j < filterText.length; j++) {
                                if (i == j) {
                                    if (i == 0 || i == (filterText.length - 1)) {
                                        newText.push(filterText[i], filterText[i]);
                                     } else {
                                        newText.push("space", filterText[i], filterText[i]);
                                    }
                                } else if ((j - i) % 2 == 0) {
                                    newText.push("space", filterText[i], filterText[j], filterText[i]);
                                } else {
                                    newText.push(filterText[j], filterText[i]);
                                }
                            }
                        }
                    }

                }
            }

            /***** create a masterarray with masters display true *****/
            var masterArray = [];
            var nrOfFonts = 0;
            if (specimenPanel == 1) {
                angular.forEach(sequences, function(sequence) {
                    angular.forEach(sequence.masters, function(master) {
                        if (master.display || master.edit[0]) {
                            nrOfFonts++;
                            masterArray.push({
                                sequenceId : sequence.id,
                                masterId : master.id,
                                name : master.name,
                                edit : master.edit[0]
                            });
                        }
                    });
                });
            } else if (specimenPanel == 2) {
                angular.forEach(families, function(family) {
                    angular.forEach(family.instances, function(instance) {
                        if (instance.display || instance == currentInstance) {
                            nrOfFonts++;
                            masterArray.push({
                                sequenceId : family.id,
                                masterId : instance.id,
                                name : instance.name
                            });
                        }
                    });
                });
            }

            /***** building the filterd string, add a glyphid for the track by at the ng-repeat *****/
            var filtered = [];
            var glyphId = 0;

            for (var q = 0; q < masterArray.length; q++) {
                // repeating for the number of master with display true. every glyph of this loop starts with a new master (masterId)
                var masterId = q;
                for (var i = 0; i < newText.length; i++) {
                    var glyph = newText[i];
                    var master = masterArray[masterId];
                    filtered.push({
                        master : {
                            sequenceId : master.sequenceId,
                            masterId : master.masterId,
                            name : master.name,
                            edit : master.edit
                        },
                        glyphName : glyph,
                        glyphId : master.name + "_" + glyph + "_" + glyphId
                    });

                    glyphId++;
                    if ((options.selectedFontby == "Glyph") || (options.selectedFontby == "Word" && glyph == "space") || (options.selectedFontby == "Specimen" && i == (newText.length - 1))) {
                        masterId++;
                    }
                    if (masterId == nrOfFonts) {
                        masterId = 0;
                    }
                }
                // specimen break after each loop
                if (q < masterArray.length - 1) {
                    filtered.push({
                        master : {
                            sequenceId : master.sequenceId,
                            masterId : master.masterId,
                            name : master.name,
                            edit : master.edit
                        },
                        glyphName : "*specimenbreak",
                        glyphId : master.name + "_*specimenbreak_" + glyphId
                    });
                }
            }
            //var time2 = new Date().getTime();
            //console.log("end filtering:" + time2);
            return filtered;
        }

        
    };
});