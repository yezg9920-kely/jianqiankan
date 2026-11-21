"""Contract and failure-path tests; fixtures do not test photo recognition or taste."""
from pathlib import Path
import copy
import hashlib
import importlib.util
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('personalization',Path(__file__).resolve().parents[1]/'scripts/compile_personalized_round.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)


class PersonalizationTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        # Only source-integrity fixtures; no real person and no image-analysis claim.
        (self.root/'original.bin').write_bytes(b'SOFTWARE FIXTURE NOT A PERSON')
        digest=hashlib.sha256((self.root/'original.bin').read_bytes()).hexdigest()
        self.case={'assets':[{'id':'front','kind':'original','view':'front','path':'original.bin','sha256':digest}]}
        self.profile={'status':'observed','analysis_method':'codex_multimodal_visual_observation','label_status':'tentative_photo_impression','style_intent':'clean_structured','input_assets':[{'asset_id':'front','sha256':digest,'visually_viewed':True}],'observations':[
            {'id':'f','feature':'vertical_impression','value':'elongated','description':'qualitative fixture','confidence':'medium','evidence_assets':['front']},
            {'id':'h','feature':'hair_outline','value':'diffuse','description':'hair fixture','confidence':'high','evidence_assets':['front']},
            {'id':'u','feature':'hairline','value':'unknown','description':'occluded fixture','confidence':'unknown','evidence_assets':['front']}],
            'limitations':['software fixture'],'design_goals':['control extra height']}
        self.plan={'expected_count':4,'options':[]}
        for n in range(4):
            self.plan['options'].append({'id':str(n),'family':f'family{n}','geometry':{'fringe':f'direction{n}','parting':f'part{n}','sides':'connected','crown':'low','perimeter':f'outline{n}'},'addresses_observations':['f'],'personal_reason':'fixture reason','hair_spec':'fixture design','service_conditions':'unreviewed','forehead_exposure':'partial'})

    def observed(self):
        return module.validate_profile(self.profile,self.case,self.root)

    def test_actual_source_hash_and_blank_template(self):
        self.assertEqual(set(self.observed()),{'f','h','u'})
        self.profile['status']='not_observed'
        with self.assertRaisesRegex(ValueError,'blank'):self.observed()
        self.profile['status']='observed'
        (self.root/'original.bin').write_bytes(b'SOURCE WAS REPLACED')
        with self.assertRaisesRegex(ValueError,'hash'):self.observed()

    def test_generated_portrait_cannot_be_contour_evidence(self):
        self.case['assets'][0]['kind']='generated'
        with self.assertRaisesRegex(ValueError,'real original'):self.observed()

    def test_unknown_cannot_be_asserted_as_certain(self):
        self.profile['observations'][-1]['confidence']='high'
        with self.assertRaisesRegex(ValueError,'Unknown'):self.observed()

    def test_recoloring_or_renaming_does_not_create_new_geometry(self):
        observations=self.observed()
        self.plan['options'][1]['geometry']=copy.deepcopy(self.plan['options'][0]['geometry'])
        self.plan['options'][1]['color']='a different color'
        self.plan['options'][1]['name']='a different marketing name'
        with self.assertRaisesRegex(ValueError,'structural difference'):module.validate_plan(self.profile,self.plan,observations)

    def test_personal_reason_cannot_rely_only_on_hidden_hairline(self):
        self.plan['options'][0]['addresses_observations']=['u']
        with self.assertRaisesRegex(ValueError,'visible customer evidence'):module.validate_plan(self.profile,self.plan,self.observed())

    def test_open_forehead_requires_unobserved_hairline_annotation(self):
        self.plan['options'][0]['forehead_exposure']='full'
        with self.assertRaisesRegex(ValueError,'unobserved hairline'):module.validate_plan(self.profile,self.plan,self.observed())
        self.plan['options'][0]['unknowns_to_check']=['hairline']
        self.assertTrue(module.validate_plan(self.profile,self.plan,self.observed())['personal_evidence_links'])

    def test_customer_evidence_changes_height_rule_and_exploration_is_explicit(self):
        option=self.plan['options'][0];option['geometry']['crown']='high'
        with self.assertRaisesRegex(ValueError,'High crown'):module.validate_plan(self.profile,self.plan,self.observed())
        option['exploration']=True;option['intentional_tradeoff']='customer explicitly wants a tall outline'
        self.assertEqual(module.validate_plan(self.profile,self.plan,self.observed())['option_count'],4)
        option.pop('exploration');option.pop('intentional_tradeoff')
        self.profile['observations'][0]['value']='balanced'
        self.assertEqual(module.validate_plan(self.profile,self.plan,self.observed())['option_count'],4)

    def test_same_family_requires_two_structure_changes(self):
        # Keep four families overall while testing two variations in one family.
        self.plan['expected_count']=5
        extra=copy.deepcopy(self.plan['options'][0]);extra['id']='extra';extra['geometry']['fringe']='another_fringe'
        self.plan['options'].append(extra)
        with self.assertRaisesRegex(ValueError,'structural difference'):module.validate_plan(self.profile,self.plan,self.observed())
        extra['geometry']['sides']='low_taper'
        self.assertEqual(module.validate_plan(self.profile,self.plan,self.observed())['silhouette_families'],4)


if __name__=='__main__':unittest.main()
