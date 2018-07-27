import { Binary } from 'bson';
import { Document, Model, Schema, Types } from 'mongoose';
import { getMongoose } from '../__mocks__/mongoose.config';
import { getSchema } from '../__mocks__/test.models';
import { AssignerOptions, FieldConfigTypes } from '../assigner.interfaces';
import { localStateStore } from '../LocalStateStore';
import { MongooseIdAssigner } from '../MongooseIdAssigner';

const mongoose = getMongoose();

afterAll(async () => {
  await mongoose.disconnect();
});

describe('MongooseIdAssigner', () => {
  let exampleSchema: Schema;
  beforeEach(() => {
    exampleSchema = getSchema(1);
    localStateStore.clear();
  });

  let exampleModel: Model<Document>;

  afterEach(async () => mongoose.connection.dropDatabase());

  describe('basics', () => {
    it('should save state to localStateStore', () => {
      const plugin = MongooseIdAssigner.plugin(exampleSchema, {
        modelName: 'example',
      });

      expect(localStateStore.getState(exampleSchema)).toBeDefined();
      expect(plugin.state).toEqual(localStateStore.getState(exampleSchema));
    });

    it('should assign _id field if only modelName option passed', async () => {
      exampleSchema.plugin(MongooseIdAssigner.plugin, {
        modelName: 'example1',
      });

      exampleModel = mongoose.model('example1', exampleSchema);

      const doc = await exampleModel.create({ personId: 'mernxl' });

      expect(doc._id).toBeTruthy();
    });

    it('should apply plugin by calling new MongooseIdAssigner', async () => {
      const plugin = new MongooseIdAssigner(exampleSchema, {
        modelName: 'example2',
      });

      expect(plugin).toBeInstanceOf(MongooseIdAssigner);

      exampleModel = mongoose.model('example2', exampleSchema);

      const doc = await exampleModel.create({ personId: 'mernxl' });

      expect(doc._id).toBeTruthy();
    });

    it('should apply plugin with method MongooseIdAssigner.plugin', async () => {
      const plugin = MongooseIdAssigner.plugin(exampleSchema, {
        modelName: 'example3',
      });

      expect(plugin).toBeInstanceOf(MongooseIdAssigner);

      exampleModel = mongoose.model('example3', exampleSchema);

      const doc = await exampleModel.create({ personId: 'mernxl' });

      expect(doc._id).toBeTruthy();
    });

    it('should create noNetwork with UUID and ObjectId', async () => {
      const plugin = MongooseIdAssigner.plugin(exampleSchema, {
        modelName: 'example4',
        fields: {
          _id: FieldConfigTypes.UUID,
          objectIdField: FieldConfigTypes.ObjectId,
        },
      });

      exampleModel = mongoose.model('example4', exampleSchema);

      try {
        const doc = await exampleModel.create({ personId: 'mernxl' });

        expect(plugin.options.network).toBe(false);
        expect((doc as any).objectIdField).toBeInstanceOf(Types.ObjectId);
      } catch (e) {
        expect(e).toBeUndefined();
      }
    });

    it('should assign _ids to Model instances with options', async () => {
      MongooseIdAssigner.plugin(exampleSchema, {
        modelName: 'example5',
        fields: {
          _id: {
            type: FieldConfigTypes.String,
            separator: 'T',
            nextId: '34T5565',
          },
        },
      });

      exampleModel = mongoose.model('example5', exampleSchema);

      try {
        const doc = await exampleModel.create({ personId: 'mernxl' });

        expect(doc._id).toBe('34T5565');
      } catch (e) {
        expect(e).toBeUndefined();
      }
    });

    it('should assign multiple ids to fields', async () => {
      const options: AssignerOptions = {
        modelName: 'example6',
        fields: {
          _id: '33333',
          photoId: 44444,
          emailId: '55555',
          personId: '66666',
          uuidField: {
            type: FieldConfigTypes.GUID,
            asBinary: true,
            version: 4,
          },
        },
      };

      exampleSchema.plugin(MongooseIdAssigner.plugin, options);
      exampleModel = mongoose.model('example6', exampleSchema);

      try {
        const doc = await exampleModel.create({ personId: 'mernxl' });
        const doc2 = await exampleModel.create({ personId: 'mernxl' });

        expect([doc._id, doc2._id]).toEqual(
          expect.arrayContaining(['33333', '33334']),
        );
        expect((doc as any).photoId).not.toBe((doc2 as any).photoId);
        expect([(doc as any).photoId, (doc2 as any).photoId]).toEqual(
          expect.arrayContaining([44444, 44445]),
        );
        expect((doc as any).emailId).not.toBe((doc2 as any).emailId);
        expect([(doc as any).emailId, (doc2 as any).emailId]).toEqual(
          expect.arrayContaining(['55555', '55556']),
        );
        expect((doc as any).personId).not.toBe((doc2 as any).personId);
        expect([(doc as any).personId, (doc2 as any).personId]).toEqual(
          expect.arrayContaining(['66666', '66667']),
        );
        expect((doc as any).uuidField).not.toBe((doc2 as any).uuidField);
        expect((doc as any).uuidField).toBeInstanceOf(Binary);
        expect((doc2 as any).uuidField).toBeInstanceOf(Binary);
      } catch (e) {
        expect(e).toBeUndefined();
      }
    });

    it('should use nextIdFunction passed at fieldConfig', async () => {
      const options: AssignerOptions = {
        modelName: 'example7',
        fields: {
          _id: '33333',
          photoId: {
            type: FieldConfigTypes.Number,
            nextId: 44444,
            nextIdFunction: (nextId: number) => nextId + 2,
          },
          personId: {
            type: FieldConfigTypes.String,
            nextId: '55555',
            nextIdFunction: (nextId: string) =>
              (parseInt(nextId, 10) + 2).toString(),
          },
        },
      };

      try {
        MongooseIdAssigner.plugin(exampleSchema, options);

        exampleModel = mongoose.model('example7', exampleSchema);

        const doc1 = await exampleModel.create({ personId: 'placeholder' });
        const doc2 = await exampleModel.create({ personId: 'placeholder' });

        expect((doc1 as any).photoId).toBe(44444);
        expect((doc1 as any).personId).toBe('55555');
        expect((doc2 as any).photoId).toBe(44446);
        expect((doc2 as any).personId).toBe('55557');
      } catch (e) {
        expect(e).toBeUndefined();
      }
    });

    it('should be robust enough to avoid duplicates', async () => {
      const options: AssignerOptions = {
        modelName: 'example8',
        fields: {
          _id: '33333',
          photoId: 44444,
          emailId: '55555',
          personId: {
            type: FieldConfigTypes.String,
            nextId: 'SPEC-7382-4344-3232',
            separator: '-',
          },
          uuidFieldString: FieldConfigTypes.UUID,
          uuidFieldBuffer: {
            type: FieldConfigTypes.UUID,
            version: 1,
            asBinary: true,
          },
          objectIdField: FieldConfigTypes.ObjectId,
        },
      };

      try {
        const plugin = MongooseIdAssigner.plugin(exampleSchema, options);

        exampleModel = mongoose.model('example8', exampleSchema);

        // initialise to ensure that
        // model is set and db is connected
        // before performing heavy tasks
        // or you can set max event listeners to 100 to suppress waits
        const state = await plugin.initialise(exampleModel);

        expect(state).toBe(1);

        const promises = [];
        for (let i = 0; i < 100; i++) {
          promises.push(exampleModel.create({ personId: 'mernxl' }));
        }

        const docs: any[] = await Promise.all(promises);
        for (let i = 0; i < 100; i++) {
          const _id = docs[i]._id;
          const photoId = docs[i].photoId;
          const emailId = docs[i].emailId;
          const personId = docs[i].personId;
          const uuidFieldString = docs[i].uuidFieldString;
          const uuidFieldBuffer = docs[i].uuidFieldBuffer;
          const objectIdField = docs[i].objectIdField;
          expect(typeof photoId).toBe('number');
          expect(typeof emailId).toBe('string');
          expect(personId).toMatch(/(SPEC-7382-4344-3)\d+/);
          expect(objectIdField).toBeInstanceOf(Types.ObjectId);
          expect(typeof uuidFieldString).toBe('string');
          expect(uuidFieldBuffer).toBeInstanceOf(Binary);

          for (const cDoc of docs) {
            if (_id === cDoc._id) {
              continue;
            }
            expect(photoId).not.toBe(cDoc.photoId);
            expect(emailId).not.toBe(cDoc.emailId);
            expect(personId).not.toBe(cDoc.personId);
            expect(objectIdField).not.toBe(cDoc.objectIdField);
            expect(uuidFieldString).not.toEqual(cDoc.uuidFieldString);
            expect(uuidFieldBuffer).not.toEqual(cDoc.uuidFieldBuffer);
          }
        }
      } catch (e) {
        expect(e).toBeUndefined();
      }
    });
  });

  describe('initialise()', () => {
    it('should initialise the plugin', () => {
      const plugin = MongooseIdAssigner.plugin(exampleSchema, {
        modelName: 'example9',
        fields: {
          _id: {
            type: FieldConfigTypes.String,
            separator: 'T',
            nextId: '34T5565',
          },
        },
      });

      exampleModel = mongoose.model('example9', exampleSchema);

      return plugin
        .initialise(exampleModel)
        .then(state => expect(state).toBe(1))
        .catch(e => expect(e).toBeUndefined());
    });

    it('should return state if called multiple times', () => {
      expect.assertions(2);
      const plugin = MongooseIdAssigner.plugin(exampleSchema, {
        modelName: 'example10',
        fields: {
          _id: {
            type: FieldConfigTypes.String,
            separator: 'T',
            nextId: '34T5565',
          },
        },
      });

      exampleModel = mongoose.model('example10', exampleSchema);

      plugin
        .initialise(exampleModel)
        .then(state => expect(state).toBe(1))
        .catch(e => expect(e).toBeUndefined());

      return plugin
        .initialise(exampleModel)
        .then(state => expect(state).toBe(1))
        .catch(e => expect(e).toBeUndefined());
    });
  });

  describe('discriminators', () => {
    let characterSchema: Schema, personSchema: Schema, droidSchema: Schema;
    beforeEach(() => {
      characterSchema = getSchema(1);
      personSchema = getSchema(2);
      droidSchema = getSchema(3);
    });

    it('should create noNetwork discriminators', async () => {
      const options: AssignerOptions = {
        modelName: 'example11',
        fields: {
          _id: FieldConfigTypes.GUID,
        },
        discriminators: {
          Person1: {
            license: FieldConfigTypes.ObjectId,
          },
          Droid1: {
            make: FieldConfigTypes.UUID,
          },
        },
      };

      const plugin = MongooseIdAssigner.plugin(characterSchema, options);

      const characterModel = mongoose.model('example11', characterSchema);
      const personModel = characterModel.discriminator('Person1', personSchema);
      const droidModel = characterModel.discriminator('Droid1', droidSchema);
      try {
        const character = await characterModel.create({
          friends: 'placeholder',
        });
        const person = await personModel.create({ friends: 'placeholder' });
        const droid = await droidModel.create({ friends: 'placeholder' });

        expect(plugin.options.network).toBe(false);
        expect((character as any)._id).toMatch(/-+/);
        expect(typeof (person as any).license).toBe('string');
        expect((droid as any).make).toMatch(/-+/);
      } catch (e) {
        expect(e).toBeUndefined();
      }
    });

    it('should create discriminators network', async () => {
      const options: AssignerOptions = {
        modelName: 'example12',
        fields: {
          someId: 4444,
        },
        discriminators: {
          Person: {
            _id: FieldConfigTypes.ObjectId,
            license: '786-TSJ-000', // default separator `-`
          },
          Droid: {
            _id: FieldConfigTypes.UUID,
            make: {
              type: FieldConfigTypes.String,
              nextId: '18Y4433',
              separator: 'Y',
            },
            timestamp: Date.now(),
          },
        },
      };

      MongooseIdAssigner.plugin(characterSchema, options);

      const characterModel = mongoose.model('example12', characterSchema);
      const personModel = characterModel.discriminator('Person', personSchema);
      const droidModel = characterModel.discriminator('Droid', droidSchema);

      try {
        const character = await characterModel.create({
          friends: 'placeholder',
        });
        const person = await personModel.create({ friends: 'placeholder' });
        const droid = await droidModel.create({ friends: 'placeholder' });
        const person1 = await personModel.create({ friends: 'placeholder' });
        const droid1 = await droidModel.create({ friends: 'placeholder' });

        expect((character as any).someId).toBe(4444);
        expect(typeof (person as any)._id).toBe('string');
        expect((person as any).someId).toBe(4445);
        expect((person as any).license).toBe('786-TSJ-000');
        expect((droid as any)._id).toMatch(/-+/);
        expect((droid as any).someId).toBe(4446);
        expect((droid as any).make).toBe('18Y4433');

        expect((person1 as any).someId).toBe(4447);
        expect((person1 as any).license).toBe('786-TSJ-001');

        expect((droid1 as any).someId).toBe(4448);
        expect((droid1 as any).make).toBe('18Y4434');
      } catch (e) {
        expect(e).toBeUndefined();
      }
    });
  });
});