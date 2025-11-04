# Gradient Factors Visualiser

This tool is a client-side webpage showing how **gradient factors** (GFs) impact the decompression plan of scuba dives. It is possible to choose GFs on most recent computers, but there is no strong guidance from manufacturers on how to do so. And default values may not be great for all situations. The goal of this tool is to build intuition on the effect of GFs.

This tool implements a simplified [Bühlmann ZHL-16C](https://en.wikipedia.org/wiki/B%C3%BChlmann_decompression_algorithm) algorithm in Javascript. 
Time-to-surface (TTS) is computed for many gradient factors values. Resulting TTS are reported as a color-coded table. Decompression plans are shown as tiny plots on mouseover, and details are repoted below the table on mouse click.

To simplify we suppose:
- a single dive
- on a single gaz: air
- a "rectangular" dive profile defined by `max_depth` and `bottom_time`
- a constant descent rate of 20 m/min
- a constant ascent rate of [10 m/min](https://www.cmas.org/fact-sheets/correct-ascent-rate.html)
- all units are in the metric system (bar, meters, minutes)

## GFs definition

Gradient factors determine the maximum allowed supersaturation in tissue compartments during a diving ascent. Supersaturation occur when a gaz partial pressure in the body is larger than its ambiant pressure. Typically the gaz is nitrogen for air dives. A small amount of supersaturation is fine and expected during ascent. But when it gets too big, bubbles can form and/or decompression sickness (DCS) can happen. A diver can use GFs to add some safety margin on top of the supersaturation limit given by base ZHL-16C. 

More specifically Gradient Factors are 2 parameters `(GF_low, GF_high)` to be set between 0% and 100%.
They were introduced by Erik Baker in [Understanding M-values, 1999](./media/1999_Baker_understanding_Mvalues.pdf).

Naming: *Gradient Factors* are named that way because:
- they are applied as a multiplicative *factor* to the base maximum allowed supersaturation (M-Value) of ZHL-16C 
- they are a *gradient* because the M-value is a *difference* between the tissue partial pressure and the environment partial pressure. This is a bit misleading because, technically a "gradient" is defined as a *rate* of change, rather than a change itself, but this is a technicality.


The smaller GFs, the more "conservative" is the dive. Typically
- a small `GF_low` tends to add deep stops
- a small `GF_high` tends to make shallow stops longer

More "conservative" typically means more stops, deeper stops and longer stops. But not necessary "safer".

## GFs history

There are 2 main families of decompression models:
- models of gaz content, like Bühlmann's ZHL-16C and other [Haldanian models](https://en.wikipedia.org/wiki/Haldane%27s_decompression_model)
- models of bubble formations, like "Varying Permeability Model" mentioned by Pyle in [The Importance of Deep Safety Stops: Rethinking Ascent Patterns From Decompression Dives, 1997](./media/1997_Pyle_bubbles.pdf)

Pyle in 1997 used bubble models to advise for **deeper stops** than Bühlmann, starting at roughly `max_depth/2`.

To reconcile them, Baker introduced in 1999 GFs to "force" Bühlmann to generate deeper stops. For instance 20/80 GFs soon became a popular "norm" in technical diving.

But from 2008, [empirical studies](./media/2009_deepstops_workshop.pdf) started to show that deeper stop didn't always reduce DCS risk, and even sometimes increased it. Experts started to doubt the usefulness of so called "deep stops" even if no one recommended raw ZHL-16C. 

Intuitively, low GF add deep stops to remove gaz from "fast" tissues, but at the same time deep stops can increase the amount of gaz in "slow" tissues. 

So more conservative (ie lower) GFs is not always safer.

## GFs values
We can find a wide variety of recommandation.
### Diving computer defaults (not all computers implement ZHL-16C)
- Garmin Descent G2: **35/75 (default)** or 40/85 or 45/95 or personalised
- Shearwater: 35/75 or 40/85 or 45/95 or personalised
- Suunto (Ocean) : 45/80 by default or personalised.
- Apeks: 90/90 ; 35/80 ; 30/70 or personalised.

### Diving organisation
2015: A [DAN article](https://dan.org/alert-diver/article/gradient-factors/) advocates the use of GF, but doesn't recommend any values, just gives some examples
>- 15/85 setting might be selected by someone who believes in deep stops and has substantial confidence in being bends-resistant
>- 30/70 setting brings the diver farther off the bottom for the first stop, which reduces continued ongassing during the ascent. Reaching only 70 percent of the M-value during ascent provides a greater buffer for decompression safety

2015: A [DAN blog post](https://dan.org/safety-prevention/diver-safety/divers-blog/gradient-factors-can-be-used-to-control-for-depth-time-exposure-and-alleviate-the-risk-of-decompression-sickness-in-recreational-diving/) show empirical finding that lower GFs is associated with less DCS
>- Depending on personal risk tolerance, the GF setting may vary but should not be greater than 0.80.

2022: [Belgium Navy presentation](./media/2022%20Be%20navy%20%20-%20Gradient%20Factor%20OptimizationPublic.pptx.pdf) recommends high and symmetrical values
>- Set GFlow = 100% to keep the first stop depth as shallow as possible
>- Increase ‘safety’ by selecting a lower GFhigh to increase the stop times
>- Current software restriction do not allow these optimal settings, therefore use symmetrical GFsettings, e.g. 90/90, 80/80, etc. 
>- Belgian Navy divers have been advised to refrain from using the default settings of the Shearwater Perdix (30/70) and instead adopted the symmetric GF setting approach.

2023: This [PADI blog post](https://pros-blog.padi.com/evolving-thought-on-deep-decompression-stops/) reviews the recent research and advises to avoid deep stops
>- there is as yet no consensus on where that ideal first stop should be, with some prominent names in decompression diving now expressing personal preferences for shallower stops represented by low GF values of 40 and 50
>- someday we will have enough research to state with confidence what that might be. We are not there yet.
>- deeper stops prescribed by bubble models are typically too deep.

2025: [CMAS makes official](https://www.cmas.org/fact-sheets/gradient-factors-gf-and-dive-computers.html) recommendations for high values:
>- Air/nitrox: GF_low=GF_high=between 90 and 80% (e.g. 90/90; 85/85; 80/80) depending on risk factor.
>- Lower GFs (e.g. 75/75 or 70/70) could be considered in the case of major risk factors, but in recreational diving this would raise the question of whether you still want to dive that day.
>- (Helium (heliox, trimix): GF_low between 30 and 50, GF_high between 70 and 80 (e.g. 50/80; 30/70).)
>- GFs are one means of DCS risk prevention, among others. They are, by definition, arbitrary and offer no guarantee.

2025: [LIFRAS](./media/2025%20-LIFRAS%20-%20%20Manuel%20Ma%20déco.pdf) (Belgium federation)
>- GFlow = GFhigh = between 85% and 90%

[FFESSM](https://ffessm-codep57.fr/uploads/menus/221/1PLj3v7koGqTbwDOU5ClWmpRnJNtdVhxysa8KIAHiX2/media/satdeco.pdf) No explicit advice has been found

### Divers and researchers
2014 M. Dugrenot, J. Gallien [IANTD](https://www.iantdbenelux.com/fr/home) in [Quel Trimix pour quelle plongée : exemples et explications de protocoles.](./media/Protocoles-De_saturation.pdf)
>- pour une plongée à l'air ou au Nx, on peut utiliser un profil Bühlmann pur ou bien utiliser des GF 80/80 s'il s'agit d'une plongée engagée.

2018 R. Devanney in [Decompression Theory course](https://www.tdisdi.com/tdi-diver-news/decompression-theory-pt-4/) for [Technical Diving International](https://en.wikipedia.org/wiki/Technical_Diving_International) 
>- To be clear, no-one knows what the optimal ascent profile should be for decompression dives. If GFs are the best approach, we don’t know what the best settings should be. Research does suggest that starting your deco shallower than as dictated by bubble models may create lower VGE counts, but how much shallower is not an answer anyone currently has. 

2019 D. Doolette wrote in [Gradient Factors in a Post-Deep Stops World](https://indepthmag.com/gradient-factors-in-a-post-deep-stops-world/) 
>-  I choose my GF low to be about 83% of the GF high, for instance GF 70/85. 

2020: [Simon Mitchell](https://en.wikipedia.org/wiki/Simon_Mitchell) in a ["What is optimal decompression?" video](https://www.youtube.com/watch?v=nIO9qI5XODw)
>- GFlow around 20 or 30 are still too deep [..] I've fallen around 50
>- GFhigh I typically choose something like 70 or 80 (70 if isolated)
>- It's not a recommendation but my personal appraisal of the evidence
>- We should de-emphasize deep stops, but it remains uncertain by how much! 

2024 Alain Foret [plongee-plaisir.com](https://www.plongee-plaisir.com/fr/)/Worldivers in [scuba diving : how should gradient factors be set ?](https://www.researchgate.net/publication/387465192_SCUBA_DIVING_HOW_SHOULD_GRADIENT_FACTORS_BE_SET) (paper in [french](https://www.researchgate.net/publication/387422510_PLONGEE_COMMENT_PARAMETRER_LES_FACTEURS_DE_GRADIENT_GF))
>- GFlow smaller than GFhigh : unsuitable with nitrogen
>- For no-stop dives, [..] only GFhigh is used
>- For air or nitrox dives, it is not advisable to dive with GF 100/100s because the safety margin of the tables[...] does not exist with a computer [...] 90/90 allows the calculation to produce results similar to those of the printed Bühlmann tables
>- Lower GFs (e.g. 75/75 or 70/70) could be considered int he case of major risk factors, but in recreational diving this would raise the question of whether you still want to dive that day
>- In summary, for nitrogen dives (air, nitrox), it is advisable to apply GFs of at least 90/90 and, depending onthe risk factors, to lower them to 85/85 (or even 80/80). In all cases, the choice of GF should be shared with themembers of the team before diving and accepted by all.

2024 [plongerenfrance.free.fr](http://plongerenfrance.free.fr/facteurs_de_gradient.html)
>- un consensus semble se dessiner pour un réglage des facteurs de gradient sur un couple de valeurs standards de 90/90 ou 85/85
>- ordinateur [...] avec paramètres d'origine 40/85 ou 45/95 [...] adaptés [...] pour des plongées loisirs dans la zone 0 à 40 mètres. Par contre, pour [...] profondes [...] paramètres [...] par défaut, ne seront clairement pas adaptés. 


Divers reporting their values on various forums 
- [reddit](https://www.reddit.com/r/scuba/comments/1f6i1rj/gradient_factors_gf_for_recreational_diving/) 30/70, 40/85, 40/70, 45/95, 30/60, 60/80, 99/99 (if gaz loss), 85/85 for rec diving and 50/80 for tech, 50/85, 80/80 ... 
- [scubaboard](https://scubaboard.com/community/threads/gradient-factors-what-is-everyone-using.597679/) 50/85, 50/70, 50/90, 30/75, 50/75, 95/95, 40/85, 70/85
- [plongeur.com (french)](https://www.plongeur.com/forums/topic/67263-du-choix-des-bons-gradient-factors-gf-en-plong%C3%A9e/#comments) and [another thread](https://www.plongeur.com/forums/topic/71388-gradient-factor/#comments) 80/80, 70/70, 15/85, 40/85, 80/80, 60/75, 50/70
>

## GFs choice
Despites those different opinions, and the lack of definitive scientific results, one need to pick a value before each dive. From those readings, I would go for 85/85 for single, air, no-shallow, non-tec dive.

However this would have to adapted to
- gaz type: highs GFs for N2, low GFs for He 
- dive type: shallow/recreational vs deco/tech dives
- physical condition: lower GFs if tired, older, sick...
- other risk factors like temperatures, altitude... 
- single dive or successive
- buddies's settings and club pratices
- instructor/dive master advices


## Acronyms

- pp: partial pressure (pression partielle)
- TTS (DTR): time to surface (durée totale de remontée).
    The estimated amount of time it will take to ascend to the surface, including
decompression stops.
    - DTI: durée totale d’immersion
    - DTP: durée totale des paliers
- Bottom time: from the beginning of descent until the start of ascent
- GF (FG): gradient factors (facteurs de gradient)
- M-value
- [MOD](https://en.wikipedia.org/wiki/Maximum_operating_depth): maximum operating depth.\
    Example: if oxygen becomes toxic at 1.40 bar of partial pressure (ie 1.4/0.21=6.6 bar of air pressure), the MOD with air is 10 * (6.6 - 1) = 56.6 m
    Note: O2 toxicity pp is usually set between 1.2 to 1.6 bar
- CCR: closed-circuit rebreather 
- NDL:  no-decompression limit time.\
    Maximum duration at a set depth to not requires deco stops
- DCS: decompression sickness


## References
[Historical original documents from Bühlmann](./media/bulmann_src_presentation.pdf)
