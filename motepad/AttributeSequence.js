define(
    [],
    function() {
        function createAttributeSequenceImpl(runs) {
            function eachRun(callback) {
                var start = 0;
                $.each(runs, function(i, run) {
                    var r = callback(i, run, start);
                    start += run.length;
                    return r;
                });
            }
        
            var self = {
                insert: function(value, start, length) {
                    var newRuns = [];
                    var hit = false;
        
                    // TODO: merge similar runs
                    eachRun(function(i, run, runStart) {
                        if(runStart + run.length <= start) {
                            newRuns.push(run);
                        } else {
                            if(run.value == value) {
                                // simple merge
                                newRuns.push({ value: value, length: run.length + length });
                            } else {
                                // split the old run in two
                                var lenA = start - runStart;
                                var lenB = runStart + run.length - start;
        
                                if(lenA > 0) {
                                    newRuns.push({ value: run.value, length: lenA });
                                } else {
                                    // the new run comes in contact with previous run
                                    if(newRuns.length > 0) {
                                        var lastRun = newRuns[newRuns.length - 1];
                                        if(lastRun.value == value) {
                                            length += lastRun.length;
                                            newRuns.pop(); // remove the last run (it is unmodifiable)
                                        }
                                    }
                                }
        
                                newRuns.push({ value: value, length: length });
                                newRuns.push({ value: run.value, length: lenB });
                            }
        
                            // copy the rest of the runs
                            newRuns = newRuns.concat(runs.slice(i + 1));
        
                            // break out of the loop
                            hit = true;
                            return false;
                        }
                    });
                    
                    if(!hit) {
                        // the new run comes in contact with previous run
                        if(newRuns.length > 0) {
                            var lastRun = newRuns[newRuns.length - 1];
                            if(lastRun.value == value) {
                                length += lastRun.length;
                                newRuns.pop(); // remove the last run (it is unmodifiable)
                            }
                        }
        
                        newRuns.push({ value: value, length: length });
                    }
        
                    return createAttributeSequenceImpl(newRuns);
                },
        
                insertAll: function(all, start) {
                    var newRuns = [];
                    var hit = false;
        
                    var added = null;
                    var remainder = null;
        
                    // TODO: merge similar runs
                    eachRun(function(i, run, runStart) {
                        if(runStart + run.length <= start) {
                            newRuns.push(run);
                        } else {
                            // split the old run in two
                            var lenA = start - runStart;
                            var lenB = runStart + run.length - start;
        
                            added = [ { value: run.value, length: lenA }].concat(all);
                            added.push({ value: run.value, length: lenB });
        
                            remainder = runs.slice(i + 1);
        
                            // break out of the loop
                            return false;
                        }
                    });
        
                    // if no match above, it is a simple append
                    if(added == null) {
                        added = all;
                        remainder = [];
                    }
        
                    var mergeRun = null;
        
                    $.each(added, function(i, add) {
                        // skip empty runs
                        if(add.length < 1)
                            return;
        
                        if(mergeRun != null) {
                            if(mergeRun.value == add.value) {
                                mergeRun.length += add.length;
                            } else {
                                newRuns.push(add); // TODO: copy external data?
                                mergeRun = add;
                            }
                        } else {
                            // the new run comes in contact with unmodifiable run
                            if(newRuns.length > 0) {
                                var lastRun = newRuns[newRuns.length - 1];
                                if(lastRun.value == add.value) {
                                    add.length += lastRun.length;
                                    newRuns.pop(); // remove the unmodifiable run
                                }
                            }
        
                            newRuns.push(add);
                        }
                    });
        
                    // copy the rest of the runs
                    // NOTE: no need to merge with remaining runs (slice B of this run is always non-empty)
                    newRuns = newRuns.concat(remainder);
        
                    return createAttributeSequenceImpl(newRuns);
                },
        
                remove: function(start, length) {
                    var end = start + length;
                    var newRuns = [];
        
                    var mergeRun = null;
        
                    // TODO: merge similar runs
                    eachRun(function(i, run, runStart) {
                        if(runStart + run.length <= start) {
                            newRuns.push(run);
                        } else if(runStart < end) {
                            if(runStart < start) {
                                // keep the starting segment
                                mergeRun = { value: run.value, length: start - runStart };
                                newRuns.push(mergeRun);
                            }
        
                            if(runStart + run.length >= end) {
                                // keep the ending segment
                                var len = runStart + run.length - end;
                                if(len > 0) {
                                    if(mergeRun != null) {
                                        // try and merge with a starting segment
                                        if(mergeRun.value == run.value) {
                                            mergeRun.length += len;
                                        } else {
                                            mergeRun = { value: run.value, length: len };
                                            newRuns.push(mergeRun);
                                        }
                                    } else {
                                        // if no starting segment, try merging with last run
                                        if(newRuns.length > 0) {
                                            var lastRun = newRuns[newRuns.length - 1];
                                            if(lastRun.value == run.value) {
                                                len += lastRun.length;
                                                newRuns.pop(); // remove the last run (it is unmodifiable)
                                            }
                                        }
        
                                        mergeRun = { value: run.value, length: len };
                                        newRuns.push(mergeRun);
                                    }
                                }
                            }
                        } else {
                            var mergeDone = false;
        
                            // no need to merge with leftover segments
                            if(mergeRun == null) {
                                // potential merge with last run
                                if(newRuns.length > 0) {
                                    var lastRun = newRuns[newRuns.length - 1];
                                    if(lastRun.value == run.value) {
                                        newRuns.pop(); // remove the last run (it is unmodifiable)
                                        newRuns.push({ value: run.value, length: run.length + lastRun.length });
                                        mergeDone = true;
                                    }
                                }
                            }
        
                            // if no merge, just reuse current run
                            if(!mergeDone)
                                newRuns.push(run);
        
                            // copy over the remainder
                            newRuns = newRuns.concat(runs.slice(i + 1));
        
                            // break out of the loop
                            return false;
                        }
                    });
        
                    return createAttributeSequenceImpl(newRuns);
                },
        
                set: function(value, start, length) {
                    var end = start + length;
                    var newRuns = [];
        
                    var mergeRun = null;
        
                    eachRun(function(i, run, runStart) {
                        if(runStart + run.length <= start) {
                            newRuns.push(run);
                        } else if(runStart < end) {
                            if(runStart < start) {
                                // keep the starting segment
                                mergeRun = { value: run.value, length: start - runStart };
                                newRuns.push(mergeRun);
                            }
        
                            if(runStart <= start) {
                                if(mergeRun != null) {
                                    // try to merge with starting segment
                                    if(mergeRun.value == value) {
                                        mergeRun.length += length;
                                    } else {
                                        mergeRun = { value: value, length: length };
                                        newRuns.push(mergeRun);
                                    }
                                } else {
                                    // try to merge with last run
                                    if(newRuns.length > 0) {
                                        var lastRun = newRuns[newRuns.length - 1];
                                        if(lastRun.value == value) {
                                            length += lastRun.length;
                                            newRuns.pop(); // remove the last run (it is unmodifiable)
                                        }
                                    }
        
                                    mergeRun = { value: value, length: length };
                                    newRuns.push(mergeRun);
                                }
                            }
        
                            // keep the ending segment
                            if(runStart + run.length > end) {
                                var len = runStart + run.length - end;
        
                                if(mergeRun.value == run.value) {
                                    mergeRun.length += len;
                                } else {
                                    newRuns.push({ value: run.value, length: len });
                                }
        
                                // non-empty ending segment precludes further merges
                                mergeRun = null;
                            }
                        } else {
                            if(mergeRun != null && mergeRun.value == run.value) {
                                mergeRun.length += run.length;
                            } else {
                                newRuns.push(run);
                            }
                            
                            // copy over the remainder
                            newRuns = newRuns.concat(runs.slice(i + 1));
        
                            // break out of the loop
                            return false;
                        }
                    });
        
                    return createAttributeSequenceImpl(newRuns);
                },
        
                eachRun: function(start, length, callback) {
                    var end = start + length;
        
                    eachRun(function(i, run, runStart) {
                        if(runStart + run.length <= start) {
                            // ignore this run
                        } else {
                            var sliceStart = Math.max(start, runStart);
                            var sliceEnd = Math.min(end, runStart + run.length);
                            var sliceLength = sliceEnd - sliceStart;
                            callback(run.value, sliceStart, sliceLength);
                            
                            // when this run is touching range end, ignore the rest of the runs
                            if(runStart + run.length >= end)
                                return false;
                        }
                    });
                },
        
                createConsumer: function() {
                    var currentRun = 0;
                    var currentRunLength = runs.length > 0 ? runs[0].length : null;
        
                    var consumer = {
                        runLength: currentRunLength,
                        runValue: runs.length > 0 ? runs[0].value : null,
                        advance: function(len) {
                            currentRunLength -= len;
                            if(currentRunLength < 0)
                                throw "cannot consume past current run length";
        
                            if(currentRunLength == 0) {
                                currentRun++;
        
                                if(currentRun >= runs.length) {
                                    currentRunLength = null;
                                    consumer.runValue = null;
                                } else {
                                    currentRunLength = runs[currentRun].length;
                                    consumer.runValue = runs[currentRun].value;
                                }
                            }
        
                            consumer.runLength = currentRunLength;
                        }
                    };
        
                    return consumer;
                }
            };
        
            return self;
        }
        
        // empty constructor
        return function() {
            return createAttributeSequenceImpl([]);
        }
    }
)
